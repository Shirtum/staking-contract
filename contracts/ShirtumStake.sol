pragma solidity 0.6.4;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract ShirtumStake is Ownable, ReentrancyGuard {

    using SafeMath for uint256;

    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);
    event Claim(address indexed user, uint256 rewards);

    // Counting
    mapping (address => uint256) public balancesByUser;
    mapping (address => uint256) public lastClaimTimeByUser;
    uint256 public totalDeposited;
    uint256 public deploymentTime;

    // Config
    uint256 public endDate = now + 9131 days; // 25 years
    uint256 public apy = 100;
    uint256 public maxBalance;
    uint256 public minDeposit;
    address public erc20;

    constructor (
        uint256 _maxBalance,
        uint256 _minDeposit,
        uint256 _apy,
        address _erc20
    ) public {
        require(_erc20 != address(0x0), 'ShirtumStake: Address must be different to 0x0');

        maxBalance = _maxBalance;
        minDeposit = _minDeposit;
        apy = _apy;
        erc20 = _erc20;
    }

    function deposit(uint256 amount) public nonReentrant() {
        require(amount >= minDeposit, 'ShirtumStake: Must send more than minimum balance');
        require(totalDeposited.add(amount) <= maxBalance, 'ShirtumStake: Maximum deposits reached');
        require(block.timestamp < endDate, 'ShirtumStake: You are late');

        uint256 requiredRewards = simulateTotalRewards(totalDeposited.add(amount));
        uint256 availableRewards = IERC20(erc20).balanceOf(address(this)).sub(totalDeposited);
        require(requiredRewards < availableRewards, 'ShirtumStake: Not enought rewards'); 

        if (balancesByUser[msg.sender] > 0) {
            uint256 currentRewards = calculateRewards(msg.sender);

            if (currentRewards > 0) {
                IERC20(erc20).transfer(msg.sender, currentRewards);
                emit Claim(msg.sender, currentRewards);
            }
        }
        lastClaimTimeByUser[msg.sender] = now;

        IERC20(erc20).transferFrom(msg.sender, address(this), amount);
        balancesByUser[msg.sender] = balancesByUser[msg.sender].add(amount);
        totalDeposited = totalDeposited.add(amount);
        emit Deposit(msg.sender, amount);
    }

    function withdraw(uint256 amount) public nonReentrant() {
        require(amount <= balancesByUser[msg.sender], 'ShirtumStake: Too much amount to withdraw');

        uint256 currentRewards = calculateRewards(msg.sender);

        if (currentRewards > 0) {
            IERC20(erc20).transfer(msg.sender, currentRewards);
            emit Claim(msg.sender, currentRewards);
        }
        lastClaimTimeByUser[msg.sender] = now;

        IERC20(erc20).transfer(msg.sender, amount);
        balancesByUser[msg.sender] = balancesByUser[msg.sender].sub(amount);
        totalDeposited = totalDeposited.sub(amount);
        emit Withdraw(msg.sender, amount);
    }

    function calculateRewards(address user) public view returns (uint256) {
        uint256 balance = balancesByUser[user];
        uint256 time = lastClaimTimeByUser[user];
        uint256 period = block.timestamp.sub(time);
        
        if (block.timestamp > endDate) {
            if (time > endDate) {
                time = endDate;
            }
            period = endDate.sub(time);
        }

        uint256 rewards = (balance.mul(apy).mul(period)).div(100 * 3600 * 24 * 365);
        return rewards;
    }

    function simulateTotalRewards(uint256 totalBalance) public view returns (uint256) {
        if (block.timestamp > endDate) {
            return 0;
        }

        uint256 period = endDate - block.timestamp;
        uint256 rewards = (totalBalance.mul(apy).mul(period)).div(100 * 3600 * 24 * 365);
        return rewards;
    }

    function setEndDate(uint256 _endDate) public onlyOwner() {
        require(_endDate > block.timestamp, 'ShirtumStake: End date must be in the future');
        endDate = _endDate;
    }

    function getDate() public view returns (uint256) {
        return block.timestamp;
    }
}