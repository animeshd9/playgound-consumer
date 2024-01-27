const Docker = require('dockerode');
const docker = new Docker();
async function test() {
    const availableContainers = await docker.listContainers({ filters: { status: ['running'] } });
    console.log(availableContainers)

} 

test()