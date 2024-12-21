// SPDX-License-Identifier: MIT

pragma solidity ^0.8.22;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { OApp, MessagingFee, Origin } from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";
import { MessagingReceipt } from "@layerzerolabs/oapp-evm/contracts/oapp/OAppSender.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract MiniBridge is OApp {
    struct CrossMessage {
        address recipient;
        address token;
        uint256 amount;
    }
    using SafeERC20 for IERC20;
    error ZeroValue();
    error ZeroAddress();
    error NotEnoughEth();
    error TokenNotSupported(address _token);
    error EthTransferFailed();
    error LenghMistmatch();
    event SentTokens(uint32 destinationChain, address recipient, address tokenIn, address tokenOut, uint256 amount);
    event TokensSuccessfulySent(address token, address received, uint256 amount);
    event TokensRequested(address token, uint256 amount);
    // a token on the network -> another network id -> same token on the another network
    mapping(address => mapping(uint32 => address)) public tokenMapping;
    // user => token => reserved amount
    mapping(address => mapping(address => uint256)) public reservedTokens;
    constructor(address _endpoint, address _delegate) OApp(_endpoint, _delegate) Ownable(_delegate) {}

    function setTokenMapping(
        address[] calldata tokens,
        uint32[] calldata networks,
        address[] calldata dstTokens
    ) external onlyOwner {
        if (tokens.length != networks.length || tokens.length != dstTokens.length) revert LenghMistmatch();
        for (uint256 i; i < tokens.length; i++) {
            tokenMapping[tokens[i]][networks[i]] = dstTokens[i];
        }
    }

    function sendTokens(
        address _token,
        address _recipient,
        uint256 _amount,
        uint32 _dstEid,
        bytes calldata _options
    ) external payable {
        if (msg.value == 0 || _amount == 0) revert ZeroValue();
        bytes memory _payload = abi.encode(_recipient, _token, _amount);
        uint256 requestedNativeFee = (quote(_dstEid, _payload, _options, false)).nativeFee;
        uint256 _toExcludeFee;
        address recipientToken;
        if (_token != address(0)) {
            recipientToken = tokenMapping[_token][_dstEid];
            if (recipientToken == address(0)) revert TokenNotSupported(_token);
        }
        if (_token == address(0)) {
            if (msg.value < (_amount + requestedNativeFee)) revert NotEnoughEth();
            _toExcludeFee = _amount;
        } else {
            IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);
        }
        if (_recipient == address(0)) _recipient = msg.sender;
        _lzSend(_dstEid, _payload, _options, MessagingFee(msg.value - _toExcludeFee, 0), payable(msg.sender));
        emit SentTokens(_dstEid, _recipient, _token, recipientToken, _amount);
    }

    // /**
    //  * @notice Sends a message from the source chain to a destination chain.
    //  * @param _dstEid The endpoint ID of the destination chain.
    //  * @param _message The message string to be sent.
    //  * @param _options Additional options for message execution.
    //  * @dev Encodes the message as bytes and sends it using the `_lzSend` internal function.
    //  * @return receipt A `MessagingReceipt` struct containing details of the message sent.
    //  */
    // function send(
    //     uint32 _dstEid,
    //     string memory _message,
    //     bytes calldata _options
    // ) external payable returns (MessagingReceipt memory receipt) {
    //     bytes memory _payload = abi.encode(_message);
    //     receipt = _lzSend(_dstEid, _payload, _options, MessagingFee(msg.value, 0), payable(msg.sender));
    // }

    /**
     * @notice Quotes the gas needed to pay for the full omnichain transaction in native gas or ZRO token.
     * @param _dstEid Destination chain's endpoint ID.
     * @param payload Encoded CrossMessage structure.
     * @param _options Message execution options (e.g., for sending gas to destination).
     * @param _payInLzToken Whether to return fee in ZRO token.
     * @return fee A `MessagingFee` struct containing the calculated gas fee in either the native token or ZRO token.
     */
    function quote(
        uint32 _dstEid,
        bytes memory payload,
        bytes memory _options,
        bool _payInLzToken
    ) public view returns (MessagingFee memory fee) {
        fee = _quote(_dstEid, payload, _options, _payInLzToken);
    }

    function generateMessageToSend(
        address recipient,
        address token,
        uint256 amount
    ) external pure returns (bytes memory) {
        return abi.encode(recipient, token, amount);
    }

    /**
     * @dev Internal function override to handle incoming messages from another chain.
     * @dev _origin A struct containing information about the message sender.
     * @dev _guid A unique global packet identifier for the message.
     * @param payload The encoded message payload being received.
     *
     * @dev The following params are unused in the current implementation of the OApp.
     * @dev _executor The address of the Executor responsible for processing the message.
     * @dev _extraData Arbitrary data appended by the Executor to the message.
     *
     * Decodes the received payload and processes it as per the business logic defined in the function.
     */
    function _lzReceive(
        Origin calldata /*_origin*/,
        bytes32 /*_guid*/,
        bytes calldata payload,
        address /*_executor*/,
        bytes calldata /*_extraData*/
    ) internal override {
        CrossMessage memory message = abi.decode(payload, (CrossMessage)); //abi.decode(payload, (string));
        if (message.recipient == address(0)) revert ZeroAddress();
        if (message.token == address(0)) {
            if (address(this).balance < message.amount) {
                reservedTokens[message.recipient][address(0)] += message.amount;
                emit TokensRequested(message.token, message.amount);
                return;
            }
            _transferEth(payable(message.recipient), message.amount);
        } else {
            if (IERC20(message.token).balanceOf(address(this)) < message.amount) {
                reservedTokens[message.recipient][message.token] += message.amount;
                emit TokensRequested(message.token, message.amount);
                return;
            }
            IERC20(message.token).safeTransfer(message.recipient, message.amount);
        }
        emit TokensSuccessfulySent(message.token, message.recipient, message.amount);
    }

    function _transferEth(address payable recipient, uint256 amount) internal {
        if (recipient == address(0) || recipient == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroValue();
        if (address(this).balance < amount) revert NotEnoughEth();
        (bool success, ) = recipient.call{ value: amount }("");
        if (!success) revert EthTransferFailed();
    }
}
