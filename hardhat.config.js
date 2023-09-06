require('dotenv').config();
require('@nomiclabs/hardhat-ethers');

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
    solidity: {
        compilers: [
            {
                version: '0.8.16',
                settings: {
                outputSelection: {
                    '*': {
                    '*': ['storageLayout'],
                    },
                },
                optimizer: {
                    enabled: true,
                    runs: 20,
                },
                },
            },
            {
                version: '0.7.6',
                settings: {
                optimizer: {
                    enabled: true,
                    runs: 10000,
                },
                },
            },
            {
                version: '0.6.12',
                settings: {
                optimizer: {
                    enabled: true,
                    runs: 1000,
                },
                },
            },
            {
                version: '0.5.16',
                settings: {
                optimizer: {
                    enabled: true,
                    runs: 1000,
                },
                },
            }
        ],
    },
    paths: {
        sources: "./src",
        tests: "./test",
        cache: "./cache",
        artifacts: "./artifacts"
    },
    networks: {
        hardhat: {
            forking: {
                url: process.env.OPTIMISM_ACCESSPOINT_URL,
                blockNumber: 108822736
            }
        },
        linea: {
            chainId:  59140,
            timeout:  20000,
            gas:      "auto",
            name:     "Linea",		
            url:      process.env.LINEA_ACCESSPOINT_URL,
            from:     process.env.LINEA_ACCOUNT,
            accounts: [process.env.LINEA_PRIVATE_KEY]
        }
    },
    etherscan: {
        apiKey: process.env.LINEA_APIKEY,
        customChains: [
        {
            network: "linea",
            chainId: 59140,
            urls: {
            apiURL: "https://api-testnet.lineascan.build/api",
            browserURL: "https://goerli.lineascan.build/"
            }
        }
        ]
    }
};