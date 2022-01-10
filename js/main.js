const ethersProvider = new ethers.providers.JsonRpcProvider('https://speedy-nodes-nyc.moralis.io/4bdc28473b549df902238ed0/eth/mainnet');

let ethPriceInUsd;
let ethPriceInEur;

window.addEventListener('load', async () => {
    
});

const openseaApi = new OpenseaApi(ethers.utils);

const stakingContractAddressMetahero = '0x6ce31a42058F5496005b39272c21c576941DBfe9';
const stakingContractAddressMetaheroCore = '0xedd4925ce390b9bb922fbdb868cdf220d64d6c25';
const stakingContractAddressPunksComic = '0xb7bceb36c5f0f8ec1fb67aaeeed2d7252112ea21';
const stakingContractAddressPunksComicSpecialEdition = '0x2db69d45771055f95050a8530add756264109ac5';

async function loadWallet() {
    let portfolioValue = 0.00;
    let breakdown = [];

    wallet = document.getElementById('wallet-address').value;

    if (wallet.indexOf('.eth')) {
        wallet = await ethersProvider.resolveName(wallet);
    }

    console.debug(wallet);

    ethPrices = await getEthPriceInOtherCurrencies();
    ethPriceInUsd = ethPrices.USD;
    ethPriceInEur = ethPrices.EUR;

    function getCollectionBySlug(collections, slug, contractAddress = null) {
        for (const collection of collections) {
            if (collection.slug !== slug) {
                continue;
            }

            if (contractAddress === null) {
                return collection;
            }

            const hasPrimaryContract = collection.primary_asset_contracts.findIndex(function (primaryAssetContract) {
                if (primaryAssetContract.address === contractAddress) {
                    return true;
                }
            });

            if (hasPrimaryContract !== -1) {
                return collection;
            }
        }

        return null;
    }

    await openseaApi.getCollectionsByOwner(wallet).then(async function (collections) {
        document.getElementById('opensea-error').style.display = 'none';

        const stakingContractAbi = ['function stakedTokensOf(address account) external view returns (uint256[] memory)'];

        const stakingContractMetahero = new ethers.Contract(stakingContractAddressMetahero, stakingContractAbi, ethersProvider);
        const stakingContractMetaheroCore = new ethers.Contract(stakingContractAddressMetaheroCore, stakingContractAbi, ethersProvider);
        const stakingContractPunksComic = new ethers.Contract(stakingContractAddressPunksComic, stakingContractAbi, ethersProvider);
        const stakingContractPunksComicSpecialEdition = new ethers.Contract(stakingContractAddressPunksComicSpecialEdition, stakingContractAbi, ethersProvider);

        const metaheroCollection = getCollectionBySlug(collections, 'metahero-generative');
        const stakedMetaheroBalance = (await stakingContractMetahero.stakedTokensOf(wallet)).length;

        const metaheroCoreCollection = getCollectionBySlug(collections, 'metaherouniverse');
        const stakedMetaheroCoreBalance = (await stakingContractMetaheroCore.stakedTokensOf(wallet)).length;

        const punksComicCollection = getCollectionBySlug(collections, 'punks-comic');
        const stakedPunksComicTokenIds = await stakingContractPunksComic.stakedTokensOf(wallet);

        const punksComicSpecialEditionCollection = getCollectionBySlug(collections, 'punks-comic');
        const stakedPunksComicSpecialEditionTokenIds = await stakingContractPunksComicSpecialEdition.stakedTokensOf(wallet);

        if (metaheroCollection === null && stakedMetaheroBalance !== 0) {
            collections.push({
                slug: 'metahero-generative',
                owned_asset_count: stakedMetaheroBalance,
                primary_asset_contracts: [{
                    name: 'MetaHero',
                    asset_contract_type: 'non-fungible'
                }]
            });
        }

        if (metaheroCollection !== null) {
            metaheroCollection.owned_asset_count += stakedMetaheroBalance;
        }

        if (metaheroCoreCollection === null && stakedMetaheroCoreBalance !== 0) {
            collections.push({
                slug: 'metaherouniverse',
                owned_asset_count: stakedMetaheroBalance,
                primary_asset_contracts: [{
                    name: 'MetaHero Core',
                    asset_contract_type: 'non-fungible'
                }]
            });
        }

        if (metaheroCoreCollection !== null) {
            metaheroCoreCollection.owned_asset_count += stakedMetaheroCoreBalance;
        }

        if (punksComicCollection === null && stakedPunksComicTokenIds.length !== 0) {
            collections.push({
                slug: 'punks-comic',
                owned_asset_count: 0,
                primary_asset_contracts: [
                    {
                        name: 'PUNKS: Issue #1',
                        address: '0x5ab21ec0bfa0b29545230395e3adaca7d552c948',
                        asset_contract_type: 'non-fungible',
                        owned_asset_token_ids: stakedPunksComicTokenIds
                    }
                ]
            });
        }

        if (punksComicCollection !== null && stakedPunksComicTokenIds.length !== 0) {
            punksComicCollection.primary_asset_contracts.forEach(function (primaryAssetContract) {
                if (primaryAssetContract.address === '0x5ab21ec0bfa0b29545230395e3adaca7d552c948') {
                    primaryAssetContract.owned_asset_token_ids = stakedPunksComicTokenIds;
                }
            })
        }

        if (punksComicSpecialEditionCollection === null && stakedPunksComicSpecialEditionTokenIds.length !== 0) {
            collections.push({
                slug: 'punks-comic',
                owned_asset_count: 0,
                primary_asset_contracts: [
                    {
                        name: 'PUNKS: Issue #1 (Special Edition)',
                        address: '0xa9c0a07a7cb84ad1f2ffab06de3e55aab7d523e8',
                        asset_contract_type: 'non-fungible',
                        owned_asset_token_ids: stakedPunksComicSpecialEditionTokenIds
                    }
                ]
            });
        }

        if (punksComicSpecialEditionCollection !== null && stakedPunksComicSpecialEditionTokenIds.length !== 0) {
            punksComicSpecialEditionCollection.primary_asset_contracts.forEach(function (primaryAssetContract) {
                if (primaryAssetContract.address === '0xa9c0a07a7cb84ad1f2ffab06de3e55aab7d523e8') {
                    primaryAssetContract.owned_asset_token_ids = stakedPunksComicSpecialEditionTokenIds;
                }
            })
        }

        await Promise.all(collections.map(async function(collection) {
            if (collection.owned_asset_count !== 0 && collection.primary_asset_contracts.length === 1 && collection.primary_asset_contracts[0].asset_contract_type === openseaApi.erc721Identifier) {
                let value;

                try {
                    value = await openseaApi.getFloorPriceForCollectionBySlug(collection.slug);
                } catch (openseaError) {
                    document.getElementById('opensea-error').style.display = 'block';
                    document.getElementById('opensea-error').innerText = 'Opensea is rate limiting, please try again in a minute or so';
                    console.error(openseaError);
                    return;
                }

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
                let assets;

                try {
                    assets = await openseaApi.getAssetsForOwnerByContract(wallet, primaryAssetContract.address);
                } catch (openseaError) {
                    document.getElementById('opensea-error').style.display = 'block';
                    document.getElementById('opensea-error').innerText = 'Opensea is rate limiting, please try again in a minute or so';
                    console.error(openseaError);
                    return;
                }

                assets = assets.assets;

                if (
                    (assets.length === 0 && !primaryAssetContract.hasOwnProperty('owned_asset_token_ids')) ||
                    (assets.length === 0 && primaryAssetContract.hasOwnProperty('owned_asset_token_ids') && primaryAssetContract.owned_asset_token_ids.length === 0)
                ) {
                    return;
                }

                if (primaryAssetContract.asset_contract_type === openseaApi.erc721Identifier) {
                    let value;

                    try {
                        value = await openseaApi.getLowestPriceOfAssetByContractAndId(primaryAssetContract.address);
                    } catch (openseaError) {
                        document.getElementById('opensea-error').style.display = 'block';
                        document.getElementById('opensea-error').innerText = 'Opensea is rate limiting, please try again in a minute or so';
                        console.error(openseaError);
                        return;
                    }

                    if (value > 0) {
                        let amount = assets.length;

                        if (primaryAssetContract.hasOwnProperty('owned_asset_token_ids') && primaryAssetContract.owned_asset_token_ids.length !== 0) {
                            amount += primaryAssetContract.owned_asset_token_ids.length;
                        }

                        portfolioValue += amount * value;
                        breakdown.push({
                            _name: primaryAssetContract.name,
                            _amount: amount,
                            _value: amount * value,
                            _contract: primaryAssetContract
                        });
                    }

                    return;
                }

                if (primaryAssetContract.asset_contract_type === openseaApi.erc1155Identifier) {
                    assets.forEach(async function (asset) {
                        let value;

                        try {
                            value = await openseaApi.getLowestPriceOfAssetByContractAndId(primaryAssetContract.address, asset.token_id);
                        } catch (openseaError) {
                            document.getElementById('opensea-error').style.display = 'block';
                            document.getElementById('opensea-error').innerText = 'Opensea is rate limiting, please try again in a minute or so';
                            console.error(openseaError);
                            return;
                        }

                        if (value > 0) {
                            let amount = collection.primary_asset_contracts.length === 1 ? collection.owned_asset_count : 1;

                            portfolioValue += value;
                            breakdown.push({
                                _name: asset.name,
                                _amount: amount,
                                _value: value * amount,
                                _asset: asset,
                                _contract: primaryAssetContract
                            });
                        }
                    })
                }
            }));
        })); 

        console.debug(portfolioValue);
        console.debug(breakdown);

        breakdown.sort((a, b) => a._value > b._value && -1 || 1);

        let breakdownTable = `
        <table class="table">
        <thead>
            <tr>
                <th>Collection</th>
                <th>Amount</th>
                <th>ETH</th>
                <th>USD</th>
                <th>EUR</th>  
            </tr>
        </thead>
        <tbody>
        `;

        for (const collection of breakdown) {
            breakdownTable += `
                <tr>
                    <td>${collection._name}</td>
                    <td>${collection._amount}</td>
                    <td>${collection._value.toFixed(2)}</td>
                    <td>${(collection._value * ethPriceInUsd).toFixed(2).toLocaleString()}</td>
                    <td>${(collection._value * ethPriceInEur).toFixed(2).toLocaleString()}</td>
                </tr>
            `;
        }

        breakdownTable += '</tbody></table>';

        document.getElementById('container-breakdown-table').innerHTML = breakdownTable;

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
