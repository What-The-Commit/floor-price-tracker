/* Moralis init code */
const serverUrl = "https://kgw0j1x3q8zc.usemoralis.com:2053/server";
const appId = "MaQGvtQTeEJQ1aY5N5Xoc0d6sHiYY3OiZsd2MnfY";

Moralis.start({ serverUrl, appId });

/* Authentication code */
async function loginWalletConnect() {
  await Moralis.User.logOut();
  let user = Moralis.User.current();

  if (!user) {
    user = await Moralis.authenticate({ signingMessage: "Log in using Moralis", provider: "walletconnect" })
      .then(function (user) {
        document.getElementById("btn-login-walletconnect").style.display = 'none';
        document.getElementById("btn-login-metamask").style.display = 'none';
        document.getElementById("btn-floor").style.display = 'block';
      })
      .catch(function (error) {
        console.error(error);
      });
  }
}

async function loginMetamask() {
  await Moralis.User.logOut();
  let user = Moralis.User.current();

  if (!user) {
    user = await Moralis.authenticate({ signingMessage: "Log in using Moralis" })
      .then(function (user) {
        document.getElementById("btn-login-metamask").style.display = 'none';
        document.getElementById("btn-login-walletconnect").style.display = 'none';
        document.getElementById("connect-first-notice").style.display = 'none';
        document.getElementById("btn-floor").style.display = 'block';
      })
      .catch(function (error) {
        console.error(error);
      });
  }
}

async function loadFloorPriceForAddress(address) {
    const lowestPrice = await Moralis.Web3API.token.getNFTLowestPrice({address: address, days: 1});

    return lowestPrice;
}

async function loadNfts() {
    let user = Moralis.User.current();

    if (!user) {
        console.error('Login first');
        return;
    }

    document.getElementById("loading-spinner").style.display = 'inline-block';

    const userEthNFTs = await Moralis.Web3API.account.getNFTs();

    var floorPrices = [];

    await Promise.all(userEthNFTs.result.map(async function(nft) {
        const lowestPrice = await loadFloorPriceForAddress(nft.token_address);
        
        floorPrices.push({
            name: nft.name,
            token_symbol: nft.symbol,
            token_address: nft.token_address,
            token_id: nft.token_id,
            price: lowestPrice.result === null ? 0 : lowestPrice.result.price / 1000000000000000000
        });
    }));

    var overallValue = 0;
    var overallValueByContract = [];

    for (floorPrice of floorPrices) {
        overallValue += floorPrice.price;

        if (overallValueByContract.find(valueByContract => valueByContract.token_address === floorPrice.token_address) === undefined) {
            overallValueByContract.push({
                name: floorPrice.name,
                token_address: floorPrice.token_address,
                price: 0
            });
        }

        overallValueByContract.find(valueByContract => valueByContract.token_address === floorPrice.token_address).price += floorPrice.price;
    }

    var html = '<table class="table"><thead><tr><th>Pos</th><th>Project</th><th>Value</th></tr></thead>';
    html += '<tfoot><tr><th>Pos</th><th>Project</th><th>Value</th></tr></thead>';
    html += '<tbody><tr class="is-selected"><th>1</th><td>Overall</td><td>' + parseFloat(overallValue).toFixed(2) + ' ETH</td></tr>';

    overallValueByContract = overallValueByContract.sort(function (a, b) {
            if (a.price > b.price) {
                return -1;
            }

            if (a.price < b.price) {
                return 1;
            }

            return 0;
    });

    for (valueByContractAddress in overallValueByContract) {
        valueByContract = overallValueByContract[valueByContractAddress];

        html += '<tr>';
        html += '<th>'+valueByContractAddress+1+'</th>';
        html += '<td>'+valueByContract.name+'</td>';
        html += '<td>'+parseFloat(valueByContract.price).toFixed(2) + ' ETH</td>';
        html += '</tr>';
    }

    html += '</table>';

    document.getElementById('floor-prices').innerHTML = '<h2 class="is-size-1 is-size-3-mobile">Floor prices based on lowest sale over the last day</h2><p class="subtitle has-text-grey mb-2">Opensea is currently unsupported, and ERC1155 are incorrectly priced</p>' + html;
    document.getElementById("btn-floor").disabled = true;
}

document.getElementById("btn-login-metamask").onclick = loginMetamask;
document.getElementById("btn-login-walletconnect").onclick = loginWalletConnect;
document.getElementById("btn-floor").onclick = loadNfts;