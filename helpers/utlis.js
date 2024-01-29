const axios = require('axios');
const fs = require('fs')
const { exec } = require('child_process');
const url = 'http://3.6.89.203:3333/api/v1/free-instance'


const createProxyList = async ( userId, data ) => {
    try {
        const response = await axios.post(`${url}/${userId}`, data);
        if(response.data.message){
            const newProxies = await getProxyList( userId );
            if(newProxies.length === 0){
                return false
            }
            const frpcFile = JSON.parse(fs.readFileSync('/etc/frp/frpc.json'));
            frpcFile.proxies.push(...newProxies);
            fs.writeFileSync('/etc/frp/frpc.json', JSON.stringify(frpcFile, null, 2))
            await reloadFrpc();
            return newProxies
        }
        return null
    } catch (error) {
        console.log(error)
    }
}

const getProxyList = async ( userId ) => {
    try {
        const { data } = await axios.get(`${url}/${userId}`);
        if( data.data?.proxies ){
            return data.data?.proxies
        }
        return [];
    } catch (error) {
        console.log(error)
    }
}

const deleteProxyList = async ( userId ) => {
    try {
        const newProxies = await getProxyList( userId );
        if(newProxies.length === 0){
            return false
        }
        const frpcFile = JSON.parse(fs.readFileSync('/etc/frp/frpc.json'));
        for ( let i = 0 ; i < newProxies.length; i++){
            const foundIndex = frpcFile.proxies.findIndex(x => x.name === newProxies[i].name)
            frpcFile.proxies.splice(foundIndex, 1)
        }
        
        fs.writeFileSync('/etc/frp/frpc.json', JSON.stringify(frpcFile, null, 2))
        await reloadFrpc();
        const { data } = await axios.delete(`${url}/${userId}`);
        return !data.message ? false : true
    } catch (error) {
       console.log(error)
    }
};

const reloadFrpc = async () => {
    return new Promise((resolve, reject) => {
        exec(`sudo systemctl restart frpc`, (err, _, stderr) => {
            if (err || stderr) {
                console.log(err || stderr)
                return reject(new Error('Error: reloading frpc'));
            }
            console.log('frpc restarted.');
            return resolve(true);
        })
    })
}


// createProxyList('123456789123456789123456', {
//    'name': 'asasasaa',
//    'localPorts': [122, 123] 
// }).then(console.log)

// getProxyList('123456789123456789123456').then(x => console.log(JSON.stringify(x, null, 2)))
// deleteProxyList('123456789123456789123456').then(console.log)

// reloadFrpc().then(console.log)

module.exports = { createProxyList, getProxyList, deleteProxyList}