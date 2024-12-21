// Get the environment configuration from .env file
//
// To make use of automatic environment setup:
// - Duplicate .env.example file and name it .env
// - Fill in the environment variables
import 'dotenv/config'

import 'hardhat-deploy'
import 'hardhat-contract-sizer'
import '@nomiclabs/hardhat-ethers'
import '@layerzerolabs/toolbox-hardhat'
import { HardhatUserConfig, HttpNetworkAccountsUserConfig } from 'hardhat/types'
import '@nomicfoundation/hardhat-verify'

import { EndpointId } from '@layerzerolabs/lz-definitions'

// Set your preferred authentication method
//
// If you prefer using a mnemonic, set a MNEMONIC environment variable
// to a valid mnemonic
const MNEMONIC = process.env.MNEMONIC

// If you prefer to be authenticated using a private key, set a PRIVATE_KEY environment variable
const PRIVATE_KEY = process.env.PRIVATE_KEY

const accounts: HttpNetworkAccountsUserConfig | undefined = MNEMONIC
    ? { mnemonic: MNEMONIC }
    : PRIVATE_KEY
      ? [PRIVATE_KEY]
      : undefined

if (accounts == null) {
    console.warn(
        'Could not find MNEMONIC or PRIVATE_KEY environment variables. It will not be possible to execute transactions in your example.'
    )
}

const { ETHERSCAN_KEY, BASESCAN_KEY, ARBISCAN_KEY, INFURA_API_KEY } = process.env

const config: HardhatUserConfig = {
    paths: {
        cache: 'cache/hardhat',
    },
    solidity: {
        compilers: [
            {
                version: '0.8.22',
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                },
            },
        ],
    },
    networks: {
        sepolia: {
            url: `https://sepolia.infura.io/v3/${INFURA_API_KEY}`,
            chainId: 11155111,
            accounts: [`${PRIVATE_KEY}`],
        },
        baseSepolia: {
            url: 'https://public.stackup.sh/api/v1/node/base-sepolia',
            chainId: 84532,
            accounts: [`${PRIVATE_KEY}`],
        },
        arbitrumSepolia: {
            url: 'https://endpoints.omniatech.io/v1/arbitrum/sepolia/public',
            chainId: 421614,
            accounts: [`${PRIVATE_KEY}`],
        },
        hardhat: {
            // Need this for testing because TestHelperOz5.sol is exceeding the compiled contract size limit
            allowUnlimitedContractSize: true,
        },
    },
    namedAccounts: {
        deployer: {
            default: 0, // wallet address of index[0], of the mnemonic in .env
        },
    },
    etherscan: {
        apiKey: {
            sepolia: ETHERSCAN_KEY,
            baseSepolia: BASESCAN_KEY,
            arbitrumSepolia: ARBISCAN_KEY,
        },
        customChains: [
            {
                network: 'sepolia',
                chainId: 11155111,
                urls: {
                    apiURL: 'https://api-sepolia.etherscan.io/api',
                    browserURL: 'https://sepolia.etherscan.io/',
                },
            },
            {
                network: 'arbitrumSepolia',
                chainId: 421614,
                urls: {
                    apiURL: 'https://api-sepolia.arbiscan.io/api',
                    browserURL: 'https://sepolia.arbiscan.io/',
                },
            },
            {
                network: 'baseSepolia',
                chainId: 84532,
                urls: {
                    apiURL: 'https://api-sepolia.basescan.org/api',
                    browserURL: 'https://sepolia.basescan.org/',
                },
            },
        ],
    },
}

export default config
