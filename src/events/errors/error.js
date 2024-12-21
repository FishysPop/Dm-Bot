module.exports = (c, client, handler) => {
};

process.on('unhandledRejection', async (reason, promise) => {
    console.log("unhandled rejection at:", promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
    console.log("Unknown interaction error:", err); 
});

process.on('uncaughtExceptionMonitor', (err, origin) => {
console.log("Uncaught Exception Monitor:", err, origin);
});

process.on('rejectionHandled', (err) => {
console.log("rejected handled:", err);
})

process.on('warning', (warning) => {
console.log("Warning:", warning);
})
