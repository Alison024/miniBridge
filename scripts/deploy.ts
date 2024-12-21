// import { deployData, listOfLzChainIds } from './helpers/constants'
import * as ethers from 'ethers'
import * as hardhat from 'hardhat'
// import { hardhat, ethers } from 'hardhat'
// these addresses ofr Base-sepolia network!!!
// const SWAP_ROUTER = '0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4'
// const LZ_ENDPOINT = '0x55370E0fBB5f5b8dAeD978BA1c075a499eB107B8'
const BaseEdnpoint = '0x6EDCE65403992e310A62460808c4b910D972f10f'
const delegate = '0xC742385d01d590D7391E11Fe95E970B915203C18'
async function main() {
    const erc1 = await ethers.getContractFactory('MockERC20')
    const bridge = await ethers.getContractFactory('MiniBridge')

    const e1 = await erc1.deploy()
    const e2 = await erc1.deploy()
    const b = await bridge.deploy(BaseEdnpoint, delegate)

    await hardhat.run('verify:verify', {
        address: b.address,
        constructorArguments: [BaseEdnpoint, delegate],
    })
    await hardhat.run('verify:verify', {
        address: e1.address,
        constructorArguments: [],
    })
    await hardhat.run('verify:verify', {
        address: e2.address,
        constructorArguments: [],
    })
}

main().catch((error) => {
    console.error(error)
    process.exitCode = 1
})
