const Docker = require('dockerode');
const amqp = require('amqplib');
require('dotenv').config()
const docker = new Docker();
const imageName = 'alpine:latest';
const mongoose = require('mongoose')
const { User } = require('./models/users')
const { isPortAvailableinHost, generateRandomNumber } = require('./helpers/port')
const { createProxyList, deleteProxyList } = require('./helpers/utlis')
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey( process.env.SENDGRID_API_KEY );

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
        '80/tcp': {},
        '3333/tcp': {},
      },
      HostConfig: {
        PortBindings: {
          [`80/tcp`]: [{ HostPort: `${randomPort[0]}` }],
          [`3333/tcp`]: [{ HostPort: `${randomPort[1]}` }],
        },
        Cpus: 2, // Set the number of CPUs
        Memory: 4 * 1024 * 1024 * 1024,
      },
      Env: [`USER_ID=${data._id}`],
    };

    try {

      const availableContainers = await docker.listContainers({ filters: { status: ['running'] } } )
      const maxContainers = 5;
      console.log( availableContainers )
      // Check if the number of running containers is less than the maximum allowed
      if (availableContainers.length < maxContainers)  {

        const container = await docker.createContainer(containerConfig);
        // console.log(container, 'dfdfdfd')
        await container.start();
        const frp = await createProxyList( data._id, { 'name': data.email, localPorts: randomPort } )
        console.log(frp)
        console.log(data._id, '---------------------------') 

        if( frp ) {
          console.log('Tunnel created for '+ data.email, data._id )
          const update = await User.findByIdAndUpdate( data._id, { 'haveContainer': true, 'portMap': randomPort, 'host':frp , 'inQueue': false } )
          const msg = {
            to: data.email ,
            from: 'noreply@setscharts.app', // Use the email address or domain you verified above
            subject: 'Playground for sets editor',
            html:`<!DOCTYPE html>
          <html lang="en">
          <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Email Template</title>
          </head>
          <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px; text-align: center;">
          
              <div style="background-color: #ffffff; max-width: 600px; margin: auto; padding: 20px; border-radius: 10px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);">
          
                  <h2 style="color: #333;">Hello there!</h2>
                  <p style="color: #666; font-size: 16px;">We're excited to share something with you. Click the link below:</p>
          
                  <a href="https://${frp[0].host}" style="display: inline-block; margin: 20px 0; padding: 15px 30px; background-color: #007bff; color: #fff; text-decoration: none; border-radius: 5px;">Visit Link</a>
                  <a href="https://${frp[1].host}/terminal" style="display: inline-block; margin: 20px 0; padding: 15px 30px; background-color: #007bff; color: #fff; text-decoration: none; border-radius: 5px;">Visit Link</a>

                  <p style="color: #666; font-size: 14px;">If the button above doesn't work, you can copy and paste the following link into your browser:</p>
                  <p style="color: #007bff; font-size: 14px;"><a href="YOUR_LINK_HERE" style="color: #007bff; text-decoration: none;">YOUR_LINK_HERE</a></p>
          
                  <p style="color: #666; font-size: 14px;">Thank you!</p>
          
              </div>
          
          </body>
          </html>`}
          console.log(update, '---------')
          await sgMail.send(msg)
        }

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
        resolve(container);
      }, 2 * 60 * 1000);
      
    } else {
      reject( new Error('Maximum number of container reached'))
    }
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
      await User.findByIdAndUpdate( userId, { 'haveContainer': false, 'inQueue': false, 'active': false } )
      await deleteProxyList( userId )
      console.log(`Destroyed container for user ${userId}`);
      resolve();
    } catch (error) {
      console.error(`Error destroying container for user ${userId}:`, error);
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


