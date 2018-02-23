/**
 * This is a example of how to use `kit.all` to deal with the
 * classic producer-consumer problem.
 *
 * Of cause, most times `kit.all` is used with a fixed array, this is a complex
 * usage of it.
*/

const kit = require('../lib/kit');

// Max running threads at the same time.
const maxProducer = 5;
const maxConsumer = 2;

const regexUrl = /<a[\w\s]+href="(http.+?)"/g;

const launch = () =>
	// The producer and the comsumer will create
	// an infinity life circle.
	kit.all([
		kit.all(maxProducer, producer, false),
		kit.all(maxConsumer, consumer, false)
	])
	.catch(err => kit.err(err.message))
;

// Broker handles the orders and products.
var broker = {
	orders: ['http://www.baidu.com'],
	products: [],

	order(urls) {
		if (urls) {
			return broker.orders = broker.orders.concat(urls);
		} else {
			return broker.orders.pop();
		}
	},

	product(page) {
		if (page) {
			return broker.products.push(page);
		} else {
			return broker.products.pop();
		}
	}
};

// Producer will download a page and add it to the store.
var producer = function() {
	const url = broker.order();

	if (!url) { return kit.sleep(200); } // Nothing to work, wait.

	kit.logs('producing:', url);
	return kit.request(url).then(broker.product);
};

// Comsumer will parse a page and find some urls in the page,
// then add the urls to the tasks.
var consumer = function() {
	const page = broker.product();

	if (!page) { return kit.sleep(200); } // Nothing to consume, wait.

	// Find url in page.
	const urls = kit.regexMap(regexUrl, page, 1);

	// Randomly get 3 urls.
	return broker.order(kit._.sample(urls, 3));
};


launch();
