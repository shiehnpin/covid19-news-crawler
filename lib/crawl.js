const cheerio = require('cheerio');
const axios = require('axios');
const moment = require('moment');
const fs = require('fs-extra');
const path = require('path');
const delay = require('delay');
const baseUrl = 'https://www.cdc.gov.tw';
const target = '/Category/NewsPage/EmXemht4IT-IRAPrAnyG9A';
const fname = path.join(process.cwd(),'news.json');
const baseURL = process.env.BASE;

async function crawlNews(url, result, condition){
	try {
		const currentUrl = new URL(url);

		let resp = await axios.get(url, {timeout: 60000});

		const $ = cheerio.load(resp.data);

		let id = currentUrl.searchParams.get('uaid');
		let title = $('.con-title')
		.contents()
		.filter(function(){ 
		  return this.nodeType == 3; 
		})[0]
		.nodeValue
	    .trim();

		let contentTop = $('.con-word').text().trim();

		let contentList = $('.col-md-9 > ol > li').map((idx,item)=>{
			return `${idx+1}. ${$(item).text()}`;
		}).get().join('\n');

		let contentBottom = $('.col-md-9').contents().filter(function(){ 
		  	return this.nodeType == 3; 
		}).map((idx, item)=>{
			return $(item).text().trim();
		}).filter((idx, item)=>{
			return item && item !== '';
		}).get().join('\n')

		let publish_date = $('.date').text().replace('發佈日期','').trim();
		let link = url;

		let newsDate = moment(publish_date,'YYYY/M/D');
		let news = {
			aid: id,
			title: title,
			image_url : '',
			content: [contentTop, contentList, contentBottom].join('\n\n').trim(),
			publish_date: newsDate.format('YYYY/MM/DD'),
			web_url: link
		}
		
		if(condition.deadline && ( newsDate.isBefore(moment(condition.deadline, 'YYYY/MM/DD')) || 
			newsDate.isSame(moment(condition.deadline, 'YYYY/MM/DD')) )){
			console.log('out-of-date', news.aid, news.publish_date);
			return false;
		}
		
		if(condition.excluded && condition.excluded.indexOf(id) !== -1){
			console.log('duplicated', news.aid, news.publish_date);
			return true;
		}
		
		console.log('add', news.aid, news.publish_date);
		result.push(news);
		return true;

	}catch(e){
		console.err(e);
		return false;
	}

}

async function crawlAll(prevRecord) {	
	
	let diff = [];

	let resp = await axios.get(baseUrl+target, {timeout: 60000});

	const $ = cheerio.load(resp.data);

	let links = $('table.JQtabNew > tbody > tr').map((i,item)=> {
		return baseUrl + $('td > a', item).attr('href');
	}).get();

	let ids = prevRecord.map(e=>e.aid);

	for(let link of links){
		let success = await crawlNews(link, diff, { excluded: ids, deadline:'2020/09/16' });
		if(!success) break;
	}

	console.log('found', diff.length, 'new articles.');

	prevRecord = diff.concat(prevRecord);

	prevRecord.sort((a,b)=>{
		return moment(a.publish_date, 'YYYY/MM/DD') - moment(b.publish_date, 'YYYY/MM/DD');
	})

	return { diff: diff, full: prevRecord};

}
//http://localhost:5001/virusmask/us-central1/publishNews
async function publish(news, baseURL) {
	const instance = axios.create({
 		baseURL: baseURL
	});

	let today = moment();

	news.sort((a,b)=>{
		return moment(a.publish_date, 'YYYY/MM/DD') - moment(b.publish_date, 'YYYY/MM/DD');
	})

	news = news.map(e=>{
		let notify = moment(e.publish_date, 'YYYY/MM/DD').isSame(today, 'day');
		
		console.log(e.publish_date, 'shouldNotify?', notify);

		return {
			title: e.title,
			image_url : e.image_url,
			content: e.content,
			publish_date: e.publish_date,
			web_url: e.web_url,
			shouldNotify: notify ? 'true' : 'false'
		}
	})

	for(let article of news){
		console.log('puslish', article.publish_date);
		const response = await instance.post('/publishNews', article);
		console.log('received', response.status, response.data.id, response.data.title, 'duplicated?', response.data.duplicated);
		delay(10000);
	}
}

async function run() {
	let prevRecord = fs.readJsonSync(fname, { throws: false }) || [] ; 

	let {diff, full} = await crawlAll(prevRecord);

	await publish(diff, baseURL);

	fs.outputJsonSync(fname, full, { spaces:4 });
}

module.exports = run;


