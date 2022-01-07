const ethersProvider = new ethers.providers.JsonRpcProvider('https://speedy-nodes-nyc.moralis.io/4bdc28473b549df902238ed0/eth/mainnet');

let ethPriceInUsd;
let ethPriceInEur;

window.addEventListener('load', async () => {
    
});

const openseaApi = new OpenseaApi(ethers.utils);

async function loadWallet() {
    let portfolioValue = 0.00;
    let breakdown = [];

    wallet = document.getElementById('wallet-address').value;

    if (wallet.indexOf('.eth')) {
        wallet = await ethersProvider.resolveName(wallet);
    }

    console.log(wallet);

    ethPrices = await getEthPriceInOtherCurrencies();
    ethPriceInUsd = ethPrices.USD;
    ethPriceInEur = ethPrices.EUR;

    await openseaApi.getCollectionsByOwner(wallet).then(async function (collections) {
        await Promise.all(collections.map(async function(collection) {
            if (collection.primary_asset_contracts.length === 1 && collection.primary_asset_contracts[0].asset_contract_type === openseaApi.erc721Identifier) {
                var value = await openseaApi.getFloorPriceForCollectionBySlug(collection.slug);
                if (value > 0) {
                    portfolioValue += collection.owned_asset_count * value;
                    breakdown.push({
                        _name: collection.primary_asset_contracts[0].name,
                        _amount: collection.owned_asset_count,
                        _value: collection.owned_asset_count * value
                    });
                }

                return;
            }

            await Promise.all(collection.primary_asset_contracts.map(async function(primaryAssetContract) {
                let assets = await openseaApi.getAssetsForOwnerByContract(wallet, primaryAssetContract.address);
                assets = assets.assets;

                if (assets.length === 0) {
                    return;
                }

                if (primaryAssetContract.asset_contract_type === openseaApi.erc721Identifier) {
                    var value = await openseaApi.getLowestPriceOfAssetByContractAndId(primaryAssetContract.address);
                    if (value > 0) {
                        portfolioValue += assets.length * value;
                        breakdown.push({
                            _name: primaryAssetContract.name,
                            _amount: assets.length,
                            _value: assets.length * value,
                            _contract: primaryAssetContract
                        });
                    }

                    return;
                }

                if (primaryAssetContract.asset_contract_type === openseaApi.erc1155Identifier) {
                    assets.forEach(async function (asset) {
                        var value = await openseaApi.getLowestPriceOfAssetByContractAndId(primaryAssetContract.address, asset.token_id);
                        if (value > 0) {
                            portfolioValue += value;
                            breakdown.push({
                                _name: asset.name,
                                _amount: 1,
                                _value: value,
                                _asset: asset,
                                _contract: primaryAssetContract
                            });
                        }
                    })

                    return;
                }
            }));
        })); 

        console.log(portfolioValue);
        console.log(breakdown);

        document.getElementById('portfolio-value-heading').style.display = 'inline-block';
        document.getElementById('portfolio-value').innerText = portfolioValue.toFixed(2);
        document.getElementById('portfolio-value-usd').innerText = (portfolioValue * ethPriceInUsd).toFixed(2).toLocaleString();
        document.getElementById('portfolio-value-eur').innerText = (portfolioValue * ethPriceInEur).toFixed(2).toLocaleString();
    });
}

async function getEthPriceInOtherCurrencies(currency = 'USD,EUR') {
    let response = await fetch("https://min-api.cryptocompare.com/data/price?fsym=ETH&tsyms=" + currency + "", {
        "headers": {
            "accept": "application/json"
        },
        "body": null,
        "method": "GET",
        "mode": "cors",
        "credentials": "omit"
    });

    let data = await response.json();

    return data;
}
