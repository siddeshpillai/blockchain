/* ===== Blockchain Class ==========================
|  Class with a constructor for new blockchain 		|
|  ================================================*/

const SHA256 = require('crypto-js/sha256');
const LevelSandbox = require('./LevelSandbox.js');
const Block = require('./Block.js');
const hex2ascii = require('hex2ascii')

class Blockchain {

    constructor() {
        this.bd = new LevelSandbox.LevelSandbox();
        this.generateGenesisBlock();
    }

    // Helper method to create a Genesis Block (always with height= 0)
    // You have to options, because the method will always execute when you create your blockchain
    // you will need to set this up statically or instead you can verify if the height !== 0 then you
    // will not create the genesis block
    generateGenesisBlock() {
        this.getBlockHeight().then((height) => {
            if (height === -1) {
                let genesisBlock = new Block.Block('First block in the chain - Genesis block');                
                Promise.resolve(this.addBlock(genesisBlock)).then((result) => { 
                    // console.log("Created Genesis Block ", result); 
                }).catch((err) => {
                    console.log('Error creating genesis block ', err)
                });
            }
        }).catch((err) => {
            reject(err);
        });        
    }

    // returns the height of the block chain
    async getBlockHeight() {
        let height = await this.bd.getBlocksCount();
        return (height - 1);
    }

    // adds a block to the chain
    async addBlockToTheChain(position, block) {
        block.hash = SHA256(JSON.stringify(block)).toString();
        let result = await this.bd.addLevelDBData(position, JSON.stringify(block));
        return Promise.resolve(result);
    }

    // Add new block
    async addBlock(block) {        
        let height = await this.bd.getBlocksCount();
        block.height = height;
        block.time = new Date().getTime().toString().slice(0,-3);
        if (height === 0) {
            let result = Promise.resolve(this.addBlockToTheChain(height, block));
            return Promise.resolve(result);    
        } else {
            let previousBlock = await this.getBlock(height-1);
            block.previousBlockHash = previousBlock.hash;
            let result = Promise.resolve(this.addBlockToTheChain(height, block));
            return Promise.resolve(result);    
        }
    }

    // Get Block By Height
    async getBlock(height) {
        let block = await this.bd.getLevelDBData(height);
        if (typeof block !== 'undefined') {
            return Promise.resolve(JSON.parse(block));
        } else {
            return Promise.reject('Block not found at height ' + height);
        }
    }

    // Get Block By Hash
    async getBlockByHash(hash) {
        let height = await this.bd.getBlocksCount();    
        let totalBlocks = height -1;

        for (let index = 0; index <= totalBlocks; index++) {
            let block = await this.bd.getLevelDBData(index);
            let _block = JSON.parse(block);
            if (_block.hash === hash) {
                let _body = _block.body
                let _address = _body.address;
                let _star = _body.star
                _star.storyDecoded = hex2ascii(_star.story);
                _body.star = _star;
                _body.address = _address;
                _block.body = _body;
                return Promise.resolve(_block);
            }
        }
        return Promise.reject('Block not found with hash ' + hash);        
    }

    // Get Block By Address
    async getBlockByAddress(address) {
        let height = await this.bd.getBlocksCount();    
        let totalBlocks = height -1;
        let blocks = [];

        for (let index = 0; index <= totalBlocks; index++) {
            let block = await this.bd.getLevelDBData(index);
            let _block = JSON.parse(block);
            let _body = _block.body
            let _address = _body.address;            
            if (_address != undefined) {
                if (_address.toString() === address.toString()) { 
                    let _star = _body.star
                    _star.storyDecoded = hex2ascii(_star.story);
                    _body.star = _star;
                    _body.address = _address;
                    _block.body = _body;  
                    blocks.push(_block);
                }
            }
        }        
        if (blocks.length > 0) {
            return Promise.resolve(JSON.parse(JSON.stringify(blocks)));
        } else {
            return Promise.reject('Block not found with address ' + address);
        }
    }
    
    // Validate if Block is being tampered by Block Height
    async validateBlock(height) {
        let result = await this.bd.getLevelDBData(height);
        let block = JSON.parse(result);
        let blockHash = block.hash;
        block.hash = '';
        var SHAOfBlock = SHA256(JSON.stringify(block)).toString();
        return Promise.resolve(blockHash === SHAOfBlock);
    }

    // Validate current block
    async validateCurrentBlock(height, totalNoOfBlocks) {   
        let currentBlockResult = await this.bd.getLevelDBData(height);
        let nextBlockHeight = height+1;
        let block = JSON.parse(currentBlockResult);
        let blockHash = block.hash;        
        let isBlockValid = await this.validateBlock(height);

        if (isBlockValid) {            
            if (nextBlockHeight !== totalNoOfBlocks) {
                let nextBlockResult = await this.bd.getLevelDBData(nextBlockHeight);
                let nextBlock = JSON.parse(nextBlockResult);
                let nextBlockPreviousBlockHash = nextBlock.previousBlockHash;                
                if (blockHash === nextBlockPreviousBlockHash) {
                    return Promise.resolve(true);
                } else {
                    return Promise.resolve('Block ' + height + ' has a mismatched link')
                }
            } else {
                return Promise.resolve(true);
            }
        } else {
            return Promise.resolve('Block ' + height + ' is corrupted');
        }                    
    }

    // Validate Blockchain
    async validateChain() {    
        let height = await this.bd.getBlocksCount();        
        var promises = [];
        for (let i = 1; i < height; i++) {
            promises.push(this.validateCurrentBlock(i, height));
        }        
        return Promise.all(promises).then((status) => {
            var result = []
            for (let i = 0; i < status.length; i++) {
                var currentBlockStatus = status[i];
                if (currentBlockStatus === true) {
                    continue;
                } else {
                    result.push(currentBlockStatus);
                }
            }
            return Promise.resolve(result);
        });    
    }

    // Utility Method to Tamper a Block for Test Validation
    // This method is for testing purpose
    _modifyBlock(height, block) {
        let self = this;
        return new Promise( (resolve, reject) => {
            self.bd.addLevelDBData(height, JSON.stringify(block).toString()).then((blockModified) => {
                resolve(blockModified);
            }).catch((err) => { console.log(err); reject(err)});
        });
    }
   
}

module.exports.Blockchain = Blockchain;