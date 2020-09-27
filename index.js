const crawl = require('./lib/crawl.js');

(async()=>{
	console.log('crawl start @', new Date().toLocaleString());
	await crawl();
	schedule.scheduleJob('15 * * * *',async function(){
		console.log('schedule crawl start @ ', new Date().toLocaleString());
		await crawl();
	});
})()

