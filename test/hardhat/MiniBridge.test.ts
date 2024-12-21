import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { Contract, ContractFactory } from 'ethers'
import { deployments, ethers } from 'hardhat'
import { Options } from '@layerzerolabs/lz-v2-utilities'

describe('MyOApp Test', function () {
    // Constant representing a mock Endpoint ID for testing purposes
    const eidA = 1
    const eidB = 2
    // Declaration of variables to be used in the test suite
    let MiniBridge: ContractFactory
    let EndpointV2Mock: ContractFactory
    let ERC20Factory: ContractFactory
    let ownerA: SignerWithAddress
    let ownerB: SignerWithAddress
    let endpointOwner: SignerWithAddress
    let miniBridgeA: Contract
    let miniBridgeB: Contract
    let mockEndpointV2A: Contract
    let mockEndpointV2B: Contract
    let mockErc1: Contract
    let mockErc2: Contract

    // Before hook for setup that runs once before all tests in the block
    before(async function () {
        // Contract factory for our tested contract
        MiniBridge = await ethers.getContractFactory('MiniBridge')
        ERC20Factory = await ethers.getContractFactory('MockERC20')
        // Fetching the first three signers (accounts) from Hardhat's local Ethereum network
        const signers = await ethers.getSigners()

        ;[ownerA, ownerB, endpointOwner] = signers

        // The EndpointV2Mock contract comes from @layerzerolabs/test-devtools-evm-hardhat package
        // and its artifacts are connected as external artifacts to this project
        //
        // Unfortunately, hardhat itself does not yet provide a way of connecting external artifacts,
        // so we rely on hardhat-deploy to create a ContractFactory for EndpointV2Mock
        //
        // See https://github.com/NomicFoundation/hardhat/issues/1040
        const EndpointV2MockArtifact = await deployments.getArtifact('EndpointV2Mock')
        EndpointV2Mock = new ContractFactory(EndpointV2MockArtifact.abi, EndpointV2MockArtifact.bytecode, endpointOwner)
    })

    // beforeEach hook for setup that runs before each test in the block
    beforeEach(async function () {
        mockErc1 = await ERC20Factory.deploy()
        mockErc2 = await ERC20Factory.deploy()

        // Deploying a mock LZ EndpointV2 with the given Endpoint ID
        mockEndpointV2A = await EndpointV2Mock.deploy(eidA)
        mockEndpointV2B = await EndpointV2Mock.deploy(eidB)

        // Deploying two instances of MyOApp contract and linking them to the mock LZEndpoint
        miniBridgeA = await MiniBridge.deploy(mockEndpointV2A.address, ownerA.address)
        miniBridgeB = await MiniBridge.deploy(mockEndpointV2B.address, ownerB.address)

        // Setting destination endpoints in the LZEndpoint mock for each MyOApp instance
        await mockEndpointV2A.setDestLzEndpoint(miniBridgeB.address, mockEndpointV2B.address)
        await mockEndpointV2B.setDestLzEndpoint(miniBridgeA.address, mockEndpointV2A.address)

        // Setting each MyOApp instance as a peer of the other
        await miniBridgeA.connect(ownerA).setPeer(eidB, ethers.utils.zeroPad(miniBridgeB.address, 32))
        await miniBridgeB.connect(ownerB).setPeer(eidA, ethers.utils.zeroPad(miniBridgeA.address, 32))

        await miniBridgeA
            .connect(ownerA)
            .setTokenMapping([mockErc1.address, mockErc2.address], [eidB, eidB], [mockErc1.address, mockErc2.address])
        await miniBridgeB
            .connect(ownerB)
            .setTokenMapping([mockErc1.address, mockErc2.address], [eidA, eidA], [mockErc1.address, mockErc2.address])

        // await miniBridgeA.
    })

    // A test case to verify message sending functionality
    it('should send a message to each destination OApp', async function () {
        const tokenToSend = mockErc1.address
        const recipient = ethers.constants.AddressZero
        const amount = ethers.utils.parseEther('1')
        const options = Options.newOptions().addExecutorLzReceiveOption(200000, 0).toHex().toString()

        const message = await miniBridgeA
            .connect(ownerA)
            .callStatic.generateMessageToSend(recipient, tokenToSend, amount)
        console.log('options', options)
        // Define native fee and quote for the message send operation
        let nativeFee = 0
        ;[nativeFee] = await miniBridgeA.quote(eidB, message, options, false)

        // Execute send operation from myOAppA
        await mockErc1.approve(miniBridgeA.address, amount)

        await miniBridgeA.connect(ownerA).sendTokens(tokenToSend, recipient, amount, eidB, options, {
            value: nativeFee,
        })
        // // Assert the resulting state of data in both MyOApp instances
        expect((await miniBridgeB.reservedTokens(ownerA.address, tokenToSend)).toString()).to.equal(amount.toString())
        // expect(await miniBridgeB.data()).to.equal('Test message.')
    })
})
