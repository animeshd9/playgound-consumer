const tcpPortUsed = require('tcp-port-used');

const generateRandomNumber = ( min, max ) => Math.floor( Math.random() * (max - min + 1) + min);
const isPortAvailableinHost = async ( port ) => !await tcpPortUsed.check(port, '127.0.0.1')
module.exports = { generateRandomNumber, isPortAvailableinHost }