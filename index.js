const Docker = require('dockerode');
const amqp = require('amqplib');
require('dotenv').config()
const docker = new Docker();
const imageName = 'alpine:latest';
const mongoose = require('mongoose')
const { User } = require('./models/users')
const { isPortAvailableinHost, generateRandomNumber } = require('./helpers/port')
const { createProxyList, deleteProxyList } = require('./helpers/utlis')

// Connect to RabbitMQ and consume messages
amqp.connect(process.env.RABBITMQ_URI).then(async (connection) => {
  await conntectToDB()
  const channel = await connection.createChannel();
  const queue = 'playground_queue';

  await channel.assertQueue(queue, { durable: true });

  console.log('Waiting for messages. To exit press CTRL+C');

  channel.consume(queue, async (msg) => {
    try {
      const userDetails = JSON.parse(msg.content.toString());
      console.log(userDetails)
      // // Create and start a new Docker container
      console.log(userDetails)
      await createAndStartContainer(userDetails);

      console.log(`Created container for user ${userDetails.email}`);
    } catch (error) {
      console.error('Error processing message:', error);
    }
  }, { noAck: true });
});

async function createAndStartContainer(data) {
  return new Promise(async (resolve, reject) => {
    // Generate a random port between 4000 and 6000
    const randomPort = await resolvePort()
    console.log( randomPort )
    
    const containerConfig = {
      Image: 'rick00/sets-editor-arm:v0.5',
      ExposedPorts: { 
        [`${randomPort[0]}/tcp`]: {},
        [`${randomPort[1]}/tcp`]: {}
            }, // Expose the randomly assigned port
      HostConfig: {
        PortBindings: { 
          [`${80}/tcp`]: [{ HostPort: `${randomPort[0]}`, }], 
          [`${3333}/tcp`]: [{ HostPort: `${randomPort[1]}`, }]
      }, // Map container port to host port
        Cpus: 2, // Set the number of CPUs
        Memory: 4 * 1024 * 1024 * 1024

      },
      Env: [
        `USER_ID=${data._id}`,
      ],
    };

    try {

      const availableContainers = await docker.listContainers({ filters: { status: ['running'] } } )
      const maxContainers = 5;
      console.log( availableContainers )
      // Check if the number of running containers is less than the maximum allowed
      // if (availableContainers.length < maxContainers)  {

        const container = await docker.createContainer(containerConfig);
        console.log(container, 'dfdfdfd')
        await container.start();
        const item = await User.findByIdAndUpdate( data._id, { haveContainer: true, portMap: randomPort } )
        const frp = await createProxyList( data._id, { 'name': data.email, localPorts: randomPort } )
        if( frp ) {
          console.log('Tunnel created for '+ data.email)
        }
      // }

      console.log(`Container for User ${data.email} ID:`, container.id);
      console.log(`Container Port:`, randomPort);

      container.logs({ follow: true, stdout: true, stderr: true }, (err, stream) => {
        if (err) {
          console.error(`Error fetching container logs for user ${data.email}:`, err);
          return;
        }

        stream.pipe(process.stdout);
      });

      // Schedule container destruction after 30 minutes
      const inspect = await container.inspect()
      console.log(inspect.State)

      /**
       * update state in database 
       */
      

      setTimeout(async () => {
        await destroyContainer(data._id, container);
      }, 5 * 60 * 1000);

      resolve(container);
    } catch (error) {
      console.log(error)
      reject(error);
    }
  });
}

async function destroyContainer(userId, container) {
  return new Promise(async (resolve, reject) => {
    try {
      // Stop and remove the container
      await container.stop();
      await container.remove();
      await User.findByIdAndUpdate( userId, { haveContainer: false, inQueue: false } )
      await deleteProxyList( userId )
      console.log(`Destroyed container for user ${email}`);
      resolve();
    } catch (error) {
      console.error(`Error destroying container for user ${email}:`, error);
      reject(error);
    }
  });
}



const conntectToDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL);
    console.log("Connected to db");
  } catch (error) {
    console.log(error);
  }
};


// resolve port 

async function resolvePort() {
  const port1 = generateRandomNumber(500, 65000);
  const port2 = generateRandomNumber(500, 65000);

  const availablePort1 = await isPortAvailableinHost(port1);
  const availablePort2 = await isPortAvailableinHost(port2);

  if (availablePort1 && availablePort2) {
    // Both ports are available, return an array containing both ports
    return [port1, port2];
  } else {
    // Either port1 or port2 is not available, retry
    return resolvePort();
  }
}


