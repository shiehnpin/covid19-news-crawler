const crawl = require('./lib/crawl.js');

(async()=>{
	console.log('crawl test ', new Date().toLocaleString());
	await crawl();
})()

