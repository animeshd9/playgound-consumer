const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    email:{
        type:String,
        required:true,
    },
    usageTimes: {
        type: Number
    },
    portMap: {
        type: Array
    },
    haveContainer: {
        type:Boolean
    },
    inQueue: {
        type: Boolean,
        default: true
    },
    host: {
        type: Array,
    },
    active: {
        type: Boolean,
        default: true
    }
})



const User = mongoose.model('users', userSchema);

module.exports = { User };