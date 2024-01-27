const amqp = require('amqplib');

class RabbitMQConnection {
  constructor(uri) {
    this.connection = null;
    this.channel = null;
    this.uri = uri; // Fix: assign the parameter value to this.uri
  }

  async connect() {
    try {
      this.connection = await amqp.connect(this.uri);
      this.channel = await this.connection.createChannel();
      console.log('Connected to RabbitMQ');
    } catch (error) {
      console.error('Error connecting to RabbitMQ:', error.message);
    }
  }

  async close() {
    try {
      if (this.connection) {
        await this.connection.close();
        console.log('Connection closed');
      }
    } catch (error) {
      console.error('Error closing RabbitMQ connection:', error.message);
    }
  }

  async createQueue(queueName) {
    try {
      await this.channel.assertQueue(queueName, {  durable: true });
      console.log(`Queue '${queueName}' created`);
    } catch (error) {
      console.error(`Error creating queue '${queueName}':`, error.message);
    }
  }

  async sendMessage(queueName, message) {
    try {
      const serializedMessage = JSON.stringify(message);
      await this.channel.sendToQueue(queueName, Buffer.from(serializedMessage), { persistent: true });
      console.log(`Message sent to queue '${queueName}':`, message);
    } catch (error) {
      console.error(`Error sending message to queue '${queueName}':`, error.message);
    }
  }

  async consumeMessages(queueName, callback) {
    try {
      await this.channel.consume(queueName, (msg) => {
        if (msg !== null) {
          callback(msg.content.toString());
          this.channel.ack(msg);
        }
      });
      console.log(`Consuming messages from queue '${queueName}'`);
    } catch (error) {
      console.error(`Error consuming messages from queue '${queueName}':`, error.message);
    }
  }
}

// Example usage:

// const rabbitMQConnection = new RabbitMQConnection('amqp://localhost:5672');

module.exports = { rabbitMQConnection : new RabbitMQConnection(process.env.RABBITMQ_URI) };
