# Advanced Sample Hardhat Project

This project demonstrates an advanced Hardhat use case, integrating other tools commonly used alongside Hardhat in the ecosystem.

The project comes with a sample contract, a test for that contract, a sample script that deploys that contract, and an example of a task implementation, which simply lists the available accounts. It also comes with a variety of other tools, preconfigured to work with the project code.

Try running some of the following tasks:

```shell
npx hardhat accounts
npx hardhat compile
npx hardhat clean
npx hardhat test
npx hardhat node
npx hardhat help
REPORT_GAS=true npx hardhat test
npx hardhat coverage
npx hardhat run scripts/deploy.ts
TS_NODE_FILES=true npx ts-node scripts/deploy.ts
npx eslint '**/*.{js,ts}'
npx eslint '**/*.{js,ts}' --fix
npx prettier '**/*.{json,sol,md}' --check
npx prettier '**/*.{json,sol,md}' --write
npx solhint 'contracts/**/*.sol'
npx solhint 'contracts/**/*.sol' --fix
```

# Etherscan verification

To try out Etherscan verification, you first need to deploy a contract to an Ethereum network that's supported by Etherscan, such as Ropsten.

In this project, copy the .env.example file to a file named .env, and then edit it to fill in the details. Enter your Etherscan API key, your Ropsten node URL (eg from Alchemy), and the private key of the account which will send the deployment transaction. With a valid .env file in place, first deploy your contract:

```shell
hardhat run --network ropsten scripts/deploy.ts
```

Then, copy the deployment address and paste it in to replace `DEPLOYED_CONTRACT_ADDRESS` in this command:

```shell
npx hardhat verify --network ropsten DEPLOYED_CONTRACT_ADDRESS "Hello, Hardhat!"
```

# Performance optimizations

For faster runs of your tests and scripts, consider skipping ts-node's type checking by setting the environment variable `TS_NODE_TRANSPILE_ONLY` to `1` in hardhat's environment. For more details see [the documentation](https://hardhat.org/guides/typescript.html#performance-optimizations).

# Analysis

### Can the NFT sale be restarted ? If so by who ?

Yes, it can be restarted by anyone if the caller sends a number not equal to 0 as the argument of the `startSale` function. If the argument is 0, then the caller must be th `deployer` of the contract.

### What problems do you find with the \_mint() function ?

According to me, the `mint()` function is vulnerable to a re-entrancy attack as it is calling the `transfer` function `payable(msg.sender).transfer((address(this)).balance - salePrice)` before completing the actual minting logic in `_mint()`.

### Why is this contract not susceptible to integer overflow/wrapping ? Would this still be true on the previous major solidity version ?

From `solidity 0.8.0`, instead of changing the value to the opposite end of the limit of the variable when it under/overflows and not throwing an error, it has started to `revert` the transaction if any of the variable under/overflows.
This was not possible by the previous version of solidty cause of the reason stated above.

### Would you change something on this contract ?

I would like to change a few of things in the contract :-

1. Using out of limit types for variables that will never exhaust its limit like `TOKEN_LIMIT` which can either be 10 or 1337. I would use `uint16` instead of `uint256` thus saving storage and gas.

2. Line up the variables in proper line in order to use the storage blocks efficiently in solidity.

3. Instead of generating a random ID which can be predicted ahead of time, I would use an external oracle to supply with an ID to avoid all the heavy computaions.
