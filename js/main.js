const ethersProvider = new ethers.providers.JsonRpcProvider('https://speedy-nodes-nyc.moralis.io/4bdc28473b549df902238ed0/eth/mainnet');

const openseaApi = new OpenseaApi(ethers.utils);

const stakingContractAddressMetahero = '0x6ce31a42058F5496005b39272c21c576941DBfe9';
const stakingContractAddressMetaheroCore = '0xedd4925ce390b9bb922fbdb868cdf220d64d6c25';
const stakingContractAddressPunksComic = '0xb7bceb36c5f0f8ec1fb67aaeeed2d7252112ea21';
const stakingContractAddressPunksComicSpecialEdition = '0x2db69d45771055f95050a8530add756264109ac5';

window.addEventListener('load', async function () {
    const urlParams = new URLSearchParams(window.location.search);

    const wallets = [];

    for (const address of urlParams.getAll('address')) {
        wallets.push({value: address});
    }

    if (wallets.length !== 0) {
        await loadWallets(wallets);
    }
})

async function loadWallets(wallets = null) {
    const urlParams = new URLSearchParams(window.location.search);

    let currencies = 'USD,EUR';

    if (urlParams.has('currencies')) {
        currencies = urlParams.get('currencies');
    }

    const ethPrices = await getEthPriceInOtherCurrencies(currencies);

    if (wallets === null) {
        wallets = document.getElementsByClassName('wallet-address');
    }

    let portfolioValue = 0.00
    let breakdown = [];

    let mergeBreakdowns = function (allBreakdowns,breakdownPerWallet){
        for (const walletCollection of breakdownPerWallet) {
            const sameCollectionIndex = allBreakdowns.findIndex(function (collection) {
                return collection._name === walletCollection._name;
            });

            if (sameCollectionIndex === -1) {
                allBreakdowns.push(walletCollection);
                continue;
            }

            allBreakdowns[sameCollectionIndex]._value += walletCollection._value;
            allBreakdowns[sameCollectionIndex]._amount += walletCollection._amount;
        }
    };

    const walletCalls = [];

    for (const wallet of wallets) {
        let walletAddress = wallet.value;

        if (walletAddress.indexOf('.eth') !== -1) {
            let response = await fetch('https://api.what-the-commit.com/ens/resolve/' + walletAddress);

            walletAddress = await response.text();
        }

        console.debug(walletAddress);



        walletCalls.push(loadWallet(walletAddress));
    }

    const allWalletBreakdowns = await Promise.all(walletCalls);

    for (const [portfolioValuePerWallet, breakdownPerWallet] of allWalletBreakdowns) {
        portfolioValue += portfolioValuePerWallet;

        if (breakdown.length === 0) {
            breakdown = breakdownPerWallet;
            continue;
        }

        mergeBreakdowns(breakdown, breakdownPerWallet);
    }

    breakdown.sort((a, b) => a._value > b._value && -1 || 1);

    let fiatHeadColumns = '';

    for (const ethPrice of Object.entries(ethPrices)) {
        fiatHeadColumns += `<th>${ethPrice[0]}</th>`;
    }

    let breakdownTable = `
        <table class="table">
        <thead>
            <tr>
                <th>Collection</th>
                <th>Amount</th>
                <th>ETH</th>
                ${fiatHeadColumns}
            </tr>
        </thead>
        <tbody>
        `;

    for (const collection of breakdown) {
        let fiatColumns = '';

        for (const ethPrice of Object.entries(ethPrices)) {
            fiatColumns += `<td>${(collection._value * ethPrice[1]).toFixed(2).toLocaleString()}</td>`;
        }

        breakdownTable += `
                <tr>
                    <td>${collection._name}</td>
                    <td>${collection._amount}</td>
                    <td>${collection._value.toFixed(2)}</td>
                    ${fiatColumns}
                </tr>
            `;
    }

    breakdownTable += '</tbody></table>';

    document.getElementById('container-breakdown-table').innerHTML = breakdownTable;

    let heading = document.getElementById('portfolio-value-heading');

    heading.innerHTML = `Current Portfolio Value<br /><span id="portfolio-value">${portfolioValue.toFixed(2)}</span>Ξ<br/>`;
    for (const ethPrice of Object.entries(ethPrices)) {
        heading.innerHTML += `<span id="portfolio-value-${ethPrice[0].toLowerCase()}">${(portfolioValue * ethPrice[1]).toFixed(2).toLocaleString()}</span> ${ethPrice[0]}<br />`;
    }

    document.getElementById('portfolio-value-heading').style.display = 'inline-block';
}

async function loadWallet(wallet) {
    let portfolioValue = 0.00;
    let breakdown = [];

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
            if (collection.slug === 'ens') {
                return;
            }

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
                        value = await getFloorPriceForContract(primaryAssetContract.address);
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
                    for (const asset of assets) {
                        let value;

                        try {
                            value = await getFloorPriceForContractAndTokenId(primaryAssetContract.address, asset.token_id);
                        } catch (openseaError) {
                            document.getElementById('opensea-error').style.display = 'block';
                            document.getElementById('opensea-error').innerText = 'Opensea is rate limiting, please try again in a minute or so';
                            console.error(openseaError);
                            return;
                        }

                        if (value > 0) {
                            let amount = 1;

                            try {
                                const contract = new ethers.Contract(primaryAssetContract.address, ['function balanceOf(address account, uint256 id) public view returns (uint256)'], ethersProvider);

                                amount = (await contract.balanceOf(wallet, asset.token_id)).toNumber();
                            } catch (error) {
                                console.error('Could not retrieve balance for owner');
                            }

                            portfolioValue += value * amount;
                            breakdown.push({
                                _name: asset.name,
                                _amount: amount,
                                _value: value * amount,
                                _asset: asset,
                                _contract: primaryAssetContract
                            });
                        }
                    }
                }
            }));
        })); 

        console.debug(wallet, portfolioValue);
        console.debug(wallet, breakdown);
    });

    return [portfolioValue, breakdown];
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

const apiHost = 'https://api.what-the-commit.com';

async function getFloorPriceForContract(contractAddress) {
    let response = await fetch(apiHost+'/nft/'+contractAddress+'/lowest-price', {method: 'POST', headers: {"Content-Type": "application/json;charset=UTF-8"}});
    let responseData = await response.json();

    try {
        return parseFloat(responseData[0].order.price['$numberDecimal']);
    } catch (error) {
        return 0.00;
    }
}

async function getFloorPriceForContractAndTokenId(contractAddress, tokenId) {
    const body = {
        "filters": [
            {
                "key": "tokenId",
                "value": tokenId
            }
        ]
    };

    let response = await fetch(apiHost+'/nft/'+contractAddress+'/lowest-price', {method: 'POST', body: JSON.stringify(body), headers: {"Content-Type": "application/json;charset=UTF-8"}});
    let responseData = await response.json();

    try {
        return parseFloat(responseData[0].order.price['$numberDecimal']);
    } catch (error) {
        return 0.00;
    }
}