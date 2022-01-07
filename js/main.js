const ethersProvider = new ethers.providers.JsonRpcProvider('https://speedy-nodes-nyc.moralis.io/4bdc28473b549df902238ed0/eth/mainnet');

const erc1155Identifier = 'semi-fungible';
const erc721Identifier = 'non-fungible';

let portfolioValue = 0.00;
let breakdown = [];

let ethPriceInUsd;
let ethPriceInEur;

window.addEventListener('load', async () => {
    
});

async function loadWallet() {
    wallet = document.getElementById('wallet-address').value;

    if (wallet.indexOf('.eth')) {
        wallet = await ethersProvider.resolveName(wallet);
    }

    console.log(wallet);

    ethPrices = await getEthPriceInOtherCurrencies();
    ethPriceInUsd = ethPrices.USD;
    ethPriceInEur = ethPrices.EUR;

    await getCollectionsByOwner(wallet).then(async function (collections) {
        await Promise.all(collections.map(async function(collection) {
            if (collection.primary_asset_contracts.length === 1 && collection.primary_asset_contracts[0].asset_contract_type === erc721Identifier) {
                var value = await getFloorPriceForCollectionBySlug(collection.slug);
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
                let assets = await getAssetsForOwnerByContract(wallet, primaryAssetContract.address);
                assets = assets.assets;

                if (assets.length === 0) {
                    return;
                }

                if (primaryAssetContract.asset_contract_type === erc721Identifier) {
                    var value = await getLowestPriceOfAssetByContractAndId(primaryAssetContract.address);
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

                if (primaryAssetContract.asset_contract_type === erc1155Identifier) {
                    assets.forEach(async function (asset) {
                        var value = await getLowestPriceOfAssetByContractAndId(primaryAssetContract.address, asset.token_id);
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

        //console.log(portfolioValue);
        //console.log(breakdown);

        document.getElementById('portfolio-value-heading').style.display = 'inline-block';
        document.getElementById('portfolio-value').innerText = portfolioValue.toFixed(2);
        document.getElementById('portfolio-value-usd').innerText = (portfolioValue * ethPriceInUsd).toFixed(2).toLocaleString();
        document.getElementById('portfolio-value-eur').innerText = (portfolioValue * ethPriceInEur).toFixed(2).toLocaleString();
    });
}

async function getCollectionsByOwner(ownerAddress) {
    let response = await fetch('https://api.opensea.io/api/v1/collections?asset_owner=' + ownerAddress + '&offset=0&limit=300', { method: 'GET' });

    return await response.json();
}

async function getFloorPriceForCollectionBySlug(slug) {
    let response = await fetch('https://api.opensea.io/api/v1/collection/' + slug + '/stats', { method: 'GET' });

    let data = await response.json();

    return data.stats.floor_price;
}

async function getLowestPriceOfAssetByContractAndId(contract, id = null) {
    const options = { method: 'GET' };

    let params = new URLSearchParams({
        asset_contract_address: contract,
        order_by: 'sale_date',
        order_direction: 'desc',
        offset: 0,
        limit: 1
    });

    if (id !== null) {
        params.append('token_ids', id);
    }

    let response = await fetch('https://api.opensea.io/api/v1/assets?' + params.toString(), options);
    let data = await response.json();

    if (data.assets.length === 0) {
        return 0.00;
    }

    if (data.assets[0].last_sale.payment_token.symbol.indexOf('USD')) {
        var string = data.assets[0].last_sale.total_price;

        string = string.slice(0, string.length - data.assets[0].last_sale.payment_token.decimals) + "," + string.slice(string.length - data.assets[0].last_sale.payment_token.decimals);

        return (parseFloat(string) / ethPriceInUsd) / parseInt(data.assets[0].last_sale.quantity);
    }

    return parseFloat(ethers.utils.formatEther(data.assets[0].last_sale.total_price))  / parseInt(data.assets[0].last_sale.quantity);
}

async function getAssetsForOwnerByContract(owner, contract) {
    let response = await fetch('https://api.opensea.io/api/v1/assets?owner='+owner+'&asset_contract_address='+contract+'&order_direction=desc&offset=0&limit=50', { method: 'GET' });

    return await response.json();
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
