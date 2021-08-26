const { expectRevert, ether, BN, time, balance } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

const Shirtum = artifacts.require("Shirtum");
const ShirtumStake = artifacts.require("ShirtumStake");

contract('ShirtumStake', function (accounts) {

  beforeEach(async function () {
    this.shirtum = await Shirtum.new(
      { from: accounts[0] }
    );

    this.maxBalance = '300000000000000000000';  // 300
    this.maxBalance2 = '1000000000000000000000';  // 1000
    this.minDeposit = '100000000000000000000';  // 100
    this.apy = '100';
    
    this.shirtumStake = await ShirtumStake.new(
      this.maxBalance,
      this.minDeposit,
      this.apy,
      this.shirtum.address,
      { from: accounts[0] }
    );
    
    await this.shirtum.transfer(this.shirtumStake.address, '100000000000000000000000000000', { from: accounts[0] });
    
    await this.shirtum.transfer(accounts[1], '250000000000000000000', { from: accounts[0] });
    await this.shirtum.approve(this.shirtumStake.address, '250000000000000000000', { from: accounts[1] });

    await this.shirtum.transfer(accounts[2], '250000000000000000000', { from: accounts[0] });
    await this.shirtum.approve(this.shirtumStake.address, '250000000000000000000', { from: accounts[2] });
  });

  describe('Requires', function () {

    it('Constructor', async function() {
      expectRevert(
        ShirtumStake.new(
          this.maxBalance,
          this.minDeposit,
          this.apy,
          '0x0000000000000000000000000000000000000000',
          { from: accounts[0] }
        ),
        'ShirtumStake: Address must be different to 0x0'
      );
    });

    it('Minimum amount by user', async function() {
      const amount = "50000000000000000000";  // 50

      expectRevert(
        this.shirtumStake.deposit(amount, { from: accounts[1] }),
        'ShirtumStake: Must send more than minimum balance'
      );
    });

    it('Maximum depostit', async function() {
      const amount = "200000000000000000000";  // 200

      await this.shirtumStake.deposit(amount, { from: accounts[1] });

      expectRevert(
        this.shirtumStake.deposit(amount, { from: accounts[2] }),
        'ShirtumStake: Maximum deposits reached'
      );
    });

    it('Withdraw more than deposited', async function() {
      const amount = "100000000000000000000";  // 100

      await this.shirtumStake.deposit(amount, { from: accounts[1] });

      expectRevert(
        this.shirtumStake.withdraw(sumStrings(amount, amount), { from: accounts[1] }),
        'ShirtumStake: Too much amount to withdraw'
      );
    });

  });

  describe('One user', function () {

    it('withdraw without rewards', async function() {
      const amount = "100000000000000000000";  // 100

      /** Deposit **/
      await this.shirtumStake.deposit(amount, { from: accounts[1] });

      /** Withdraw **/
      await this.shirtumStake.withdraw(amount, { from: accounts[1] });

      assert.isTrue(
        BigInt((await this.shirtumStake.calculateRewards.call(accounts[1])).toString()) 
          == BigInt('0'),
        'calculateRewards has wrong value'
      ); 
    });

    it('two deposits without rewards', async function() {
      const amount = "100000000000000000000";  // 100

      /** Deposit **/
      await this.shirtumStake.deposit(amount, { from: accounts[1] });
      await this.shirtumStake.deposit(amount, { from: accounts[1] });

      /** Withdraw **/
      await this.shirtumStake.withdraw(sumStrings(amount, amount), { from: accounts[1] });

      assert.isTrue(
        BigInt((await this.shirtumStake.calculateRewards.call(accounts[1])).toString()) 
          == BigInt('0'),
        'calculateRewards has wrong value'
      );
    });

    it('one time', async function() {
      const amount = "100000000000000000000";  // 100

      const now = (new Date().getTime() / 1000);
      await time.increaseTo(now);

      /** Deposit **/
      const balanceBefore = await this.shirtum.balanceOf(accounts[1]);
      await this.shirtumStake.deposit(amount, { from: accounts[1] });
      const balanceAfter = await this.shirtum.balanceOf(accounts[1]);

      assert.equal(
        balanceAfter.toString(),
        subStrings(balanceBefore, amount),
        'Amount not deduced'
      );
      assert.equal(
        ((await this.shirtumStake.balancesByUser.call(accounts[1]))).toString(),
        amount,
        'balancesByUser has wrong value'
      );
      assert.equal(
        ((await this.shirtumStake.totalDeposited.call())).toString(),
        amount,
        'totalDeposited has wrong value'
      ); 
      
      /** Wait **/
      await time.increase(31557600); // 12 months

      assert.isTrue(
        BigInt((await this.shirtumStake.calculateRewards.call(accounts[1])).toString()) 
          > BigInt('100000000000000000000'),
        'calculateRewards has wrong value'
      );

      /** Withdraw **/
      await this.shirtumStake.withdraw(amount, { from: accounts[1] });

      assert.isTrue(
        BigInt((await this.shirtum.balanceOf(accounts[1])).toString()) 
          > BigInt('300000000000000000000'),
        'balance has wrong value'
      );
    });

    it('two times', async function() {
      const amount = "100000000000000000000";  // 100

      /** Deposit **/
      const balanceBefore = await this.shirtum.balanceOf(accounts[1]);
      await this.shirtumStake.deposit(amount, { from: accounts[1] });
      
      /** Wait **/
      await time.increase(15778800); // 6 months

      assert.isTrue(
        BigInt((await this.shirtumStake.calculateRewards.call(accounts[1])).toString()) 
          > BigInt('50000000000000000000'),
        'calculateRewards has wrong value'
      );
      assert.equal(
        (await this.shirtum.balanceOf(accounts[1])).toString(),
        sumStrings(amount, '50000000000000000000'),
        'balance has wrong value'
      );

      /** Deposit **/
      await this.shirtumStake.deposit(amount, { from: accounts[1] });

      assert.isTrue(
        BigInt((await this.shirtum.balanceOf(accounts[1])).toString()) 
          > BigInt('100000000000000000000'),
        'balance has wrong value'
      );

      /** Wait **/
      await time.increase(15778800); // 6 months

      assert.isTrue(
        BigInt((await this.shirtumStake.calculateRewards.call(accounts[1])).toString())
          > BigInt('100000000000000000000'),
        'calculateRewards has wrong value'
      );

      /** Withdraw **/
      await this.shirtumStake.withdraw('200000000000000000000', { from: accounts[1] });

      assert.isTrue(
        BigInt((await this.shirtum.balanceOf(accounts[1])).toString())
          > BigInt('400000000000000000000'),
        'balance has wrong value'
      );
    });

  });

  describe('Two users', function () {

    it('one time each', async function() {
      const amount = "100000000000000000000";  // 100

      /** Deposit **/
      const balanceBeforeOne = await this.shirtum.balanceOf(accounts[1]);
      const balanceBeforeTwo = await this.shirtum.balanceOf(accounts[1]);

      await this.shirtumStake.deposit(amount, { from: accounts[1] });
      await time.increase(15778800); // 6 months
      await this.shirtumStake.deposit(amount, { from: accounts[2] });
      await time.increase(15778800); // 6 months

      /** Withdraw **/
      await this.shirtumStake.withdraw(amount, { from: accounts[1] });
      await this.shirtumStake.withdraw(amount, { from: accounts[2] });

      assert.isTrue(
        BigInt((await this.shirtum.balanceOf(accounts[1])).toString())
          > BigInt(sumStrings(balanceBeforeOne, '50000000000000000000')),
        'calculateRewards has wrong value'
      );

      assert.isTrue(
        BigInt((await this.shirtum.balanceOf(accounts[2])).toString())
          > BigInt(sumStrings(balanceBeforeTwo, '50000000000000000000')),
        'calculateRewards has wrong value'
      ); 
    });

    it('two times each', async function() {
      const amount = "100000000000000000000";  // 100

      /** Deposit **/
      await this.shirtumStake.deposit(amount, { from: accounts[1] });
      await time.increase(15778800); // 6 months
      await this.shirtumStake.deposit(amount, { from: accounts[2] });
      await time.increase(15778800); // 6 months
      await this.shirtumStake.deposit(amount, { from: accounts[2] });
      await time.increase(15778800); // 6 months

      /** Withdraw **/
      await this.shirtumStake.withdraw(sumStrings(amount, amount), { from: accounts[2] });
      await this.shirtumStake.deposit(amount, { from: accounts[1] });
      await time.increase(15778800); // 6 months
      await this.shirtumStake.withdraw(sumStrings(amount, amount), { from: accounts[1] });

      assert.isTrue(
        BigInt((await this.shirtum.balanceOf(accounts[1])).toString())
          > BigInt('500000000000000000000'),
        'calculateRewards has wrong value'
      );

      assert.isTrue(
        BigInt((await this.shirtum.balanceOf(accounts[2])).toString())
          > BigInt('400000000000000000000'),
        'calculateRewards has wrong value'
      ); 
    });

  });

  describe('End date', function () {
    it('all checks', async function() {
      this.shirtumStake = await ShirtumStake.new(
        this.maxBalance,
        this.minDeposit,
        this.apy,
        this.shirtum.address,
        { from: accounts[0] }
      );
      
      await this.shirtum.transfer(this.shirtumStake.address, '1000000000000000000000000000', { from: accounts[0] });
      
      await this.shirtum.transfer(accounts[1], '250000000000000000000', { from: accounts[0] });
      await this.shirtum.approve(this.shirtumStake.address, '250000000000000000000', { from: accounts[1] });
  
      await this.shirtum.transfer(accounts[2], '250000000000000000000', { from: accounts[0] });
      await this.shirtum.approve(this.shirtumStake.address, '250000000000000000000', { from: accounts[2] });

      const amount = "100000000000000000000";  // 100

      /** Deposit **/
      const balanceBefore = await this.shirtum.balanceOf(accounts[1]);
      await this.shirtumStake.deposit(amount, { from: accounts[1] });
      
      /** Wait **/
      await time.increase(788940000); // 25 years

      /** Deposit **/
      expectRevert(
        this.shirtumStake.deposit(amount, { from: accounts[1] }),
        'ShirtumStake: You are late',
      );
      
      /** Checks **/
      const currentRewards = (await this.shirtumStake.calculateRewards.call(accounts[1])).toString();

      await time.increase(2629800); // 1 month

      assert.equal(
        currentRewards,
        (await this.shirtumStake.calculateRewards.call(accounts[1])).toString(),
        'calculateRewards not stopped'
      ); 

      expectRevert(
        this.shirtumStake.setEndDate('1'),
        'ShirtumStake: End date must be in the future'
      );

      await this.shirtumStake.setEndDate(32523246949);
    });
  });

  describe('MaxRewards', function () {
    it('all checks', async function() {
      this.shirtumStake = await ShirtumStake.new(
        this.maxBalance2,
        this.minDeposit,
        this.apy,
        this.shirtum.address,
        { from: accounts[0] }
      );

      const now = await this.shirtumStake.getDate();
      await this.shirtumStake.setEndDate(parseInt(now.toString()) + 31556952, { from: accounts[0] });
      
      await this.shirtum.transfer(this.shirtumStake.address, '251000000000000000000', { from: accounts[0] });
      
      await this.shirtum.transfer(accounts[1], '250000000000000000000', { from: accounts[0] });
      await this.shirtum.approve(this.shirtumStake.address, '250000000000000000000', { from: accounts[1] });

      await this.shirtum.transfer(accounts[2], '250000000000000000000', { from: accounts[0] });
      await this.shirtum.approve(this.shirtumStake.address, '250000000000000000000', { from: accounts[2] });

      const amount = "250000000000000000000"; 

      /** Deposit **/
      const balanceBefore = await this.shirtum.balanceOf(accounts[1]);
      await this.shirtumStake.deposit(amount, { from: accounts[1] });

      /** Deposit **/
      expectRevert(
        this.shirtumStake.deposit(amount, { from: accounts[2] }),
        'ShirtumStake: Not enought rewards'
      );
    });

    it('deposit + withdraw + deposit', async function() {
      this.shirtumStake = await ShirtumStake.new(
        this.maxBalance2,
        this.minDeposit,
        this.apy,
        this.shirtum.address,
        { from: accounts[0] }
      );

      const now = await this.shirtumStake.getDate();
      await this.shirtumStake.setEndDate(parseInt(now.toString()) + 31556952, { from: accounts[0] });
      
      await this.shirtum.transfer(this.shirtumStake.address, '300000000000000000000', { from: accounts[0] });
      
      await this.shirtum.transfer(accounts[1], '250000000000000000000', { from: accounts[0] });
      await this.shirtum.approve(this.shirtumStake.address, '250000000000000000000', { from: accounts[1] });

      await this.shirtum.transfer(accounts[2], '250000000000000000000', { from: accounts[0] });
      await this.shirtum.approve(this.shirtumStake.address, '250000000000000000000', { from: accounts[2] });

      const amount1 = "100000000000000000000"; 
      const amount2 = "200000000000000000000"; 

      /** Deposit **/
      await this.shirtumStake.deposit(amount1, { from: accounts[1] });

      /** Wait **/
      await time.increase(2629800); // 1 month
      await this.shirtumStake.withdraw(amount1, { from: accounts[1] });

      /** Deposit **/
      await this.shirtumStake.deposit(amount2, { from: accounts[2] });
      
      /** Deposit **/
      expectRevert(
        this.shirtumStake.deposit(amount1, { from: accounts[1] }),
        'ShirtumStake: Not enought rewards'
      );
    });
  });

});

function sumStrings(a,b) { 
  return ((BigInt(a)) + BigInt(b)).toString();
}

function subStrings(a,b) { 
  return ((BigInt(a)) - BigInt(b)).toString();
}
