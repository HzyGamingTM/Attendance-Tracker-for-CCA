const { OAuth2Client } = require('google-auth-library');
const crypto = require("crypto");
const client = new OAuth2Client();
const fastify = require("fastify")({
	logger: false,
});


const fs = require("fs");
const path = require("path");


let users = {};

const SERVER_DATA_PATH = path.join(__dirname, ".data")


/**********************/
/*  Utility functions */
/**********************/


function cookieValueFromRequest(request, name) {
	if (!request) return undefined;
	if (!request.headers) return undefined;
	if (!request.headers.cookie) return undefined;

	if (typeof (request.headers.cookie) != "string") return undefined;

	let result = request.headers.cookie.split(";")
		.map(item => item.trim())
		.filter(item => item.startsWith(`${name}=`));

	if (!result.length) return undefined;

	return result[0].split("=")[1];
}



function decodeJwtResponse(token) {
	let base64Url = token.split('.')[1];
	let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
	let jsonPayload = decodeURIComponent(Buffer.from(base64, "base64").toString("utf8").split('').map(function (c) {
		return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
	}).join(''));

	return JSON.parse(jsonPayload);
}


/*********************/
/*       Setup       */
/*********************/


fastify.register(require("@fastify/static"), {
	root: path.join(__dirname, "public"),
	prefix: "/",
});

fastify.register(require("@fastify/formbody"));

fastify.register(require("@fastify/multipart"));

fastify.register(require("@fastify/view"), {
	engine: {
		handlebars: require("handlebars"),
	},
});


/***********************/
/*        Pages        */
/***********************/


fastify.get("/", (request, reply) => {
	return reply.view("/src/pages/index.html");
});

fastify.post("/signout", (request, reply) => {
	let userToken = cookieValueFromRequest(request, "token");

	if (userToken)
		users[userToken] = undefined;

	reply.code(302);
	reply.header("Location", "/login");
	return reply.send("");
});


fastify.get("/login", (request, reply) => {

	// Redirect to dashboard if user is logged in
	let userToken = cookieValueFromRequest(request, "token");

	if (userToken && users[userToken]) {
		if (users[userToken].exp > Date.now() * 0.001) {

			reply.code(302);
			reply.header("Location", "/dashboard");
			return reply.send("");

		} else {

			users[userToken] = undefined;

		}
	}

	return reply.view("/src/pages/login.html");
});

fastify.get("/dashboard", (request, reply) => {
	// return reply.view("/src/pages/dashboard.hbs");

	let userToken = cookieValueFromRequest(request, "token");

	if (userToken && users[userToken]) {
		if (users[userToken].exp > Date.now() * 0.001) {
			return reply.view("/src/pages/dashboard.hbs");
		} else {
			users[userToken] = undefined;
		}
	}

	reply.code(302);
	reply.header("Set-Cookie", `token=x; Secure; HttpOnly; Expires=${new Date(0).toUTCString()}`);
	reply.header("Location", "/login");
	return reply.send("");
});

fastify.get("/dashboard_data", (request, reply) => {
	let userToken = cookieValueFromRequest(request, "token");

	if (userToken && users[userToken]) {
		if (users[userToken].exp > Date.now() * 0.001) {
			return reply.view("/src/pages/settings.hbs");
		} else {
			users[userToken] = undefined;
		}
	}

	reply.code(302);
	reply.header("Set-Cookie", `token=x; Secure; HttpOnly; Expires=${new Date(0).toUTCString()}`);

	return reply.send("");
});

fastify.get("/settings", (request, reply) => {
	// return reply.view("/src/pages/dashboard.hbs");

	let userToken = cookieValueFromRequest(request, "token");

	if (userToken && users[userToken]) {
		if (users[userToken].exp > Date.now() * 0.001) {
			return reply.view("/src/pages/settings.hbs");
		} else {
			users[userToken] = undefined;
		}
	}

	reply.code(302);
	reply.header("Set-Cookie", `token=x; Secure; HttpOnly; Expires=${new Date(0).toUTCString()}`);
	reply.header("Location", "/login");
	return reply.send("");
});

fastify.get("/payments", (request, reply) => {
	// return reply.view("/src/pages/dashboard.hbs");

	let userToken = cookieValueFromRequest(request, "token");

	if (userToken && users[userToken]) {
		if (users[userToken].exp > Date.now() * 0.001) {
			return reply.view("/src/pages/payments.hbs");
		} else {
			users[userToken] = undefined;
		}
	}

	reply.code(302);
	reply.header("Set-Cookie", `token=x; Secure; HttpOnly; Expires=${new Date(0).toUTCString()}`);
	reply.header("Location", "/login");
	return reply.send("");
});

// Handles post

fastify.post("/login", (req, res) => {
	let csrfTokenBody = req.body.g_csrf_token;
	let csrfTokenCookie = cookieValueFromRequest(req, "g_csrf_token");

	if (csrfTokenBody == undefined || csrfTokenBody != csrfTokenCookie) {
		res.code(401);
		return res.send("Invalid Login (sneaky baka)");
	}

	let decodedReq = decodeJwtResponse(req.body.credential);
	let userToken = crypto.randomBytes(16).toString("hex");
	let expTs = decodedReq.exp;  // ts pmo

	users[userToken] = { googleId: decodedReq.sub, exp: expTs };

	res.code(302);
	res.header("Location", "/dashboard");
	res.header("Set-Cookie", `token=${userToken}; Secure; HttpOnly; Expires=${new Date(1000 * expTs).toUTCString()}`);
	return res.send("");
});


fastify.post("/dashboard", (req, res) => {
	console.log("i definitely run");
	let userToken = cookieValueFromRequest(req, "token");

	// WARNING: this code bypasses login requirements !!!!!!!!
	handleNewPayment(req);
	return res.send("autism");

	if (userToken && users[userToken]) {
		if (users[userToken].exp > Date.now() * 0.001) {
			handleNewPayment(req);
			return res.send("autism");
		} else {
			users[userToken] = undefined;
		}
	}

	res.code(302);
	res.header("Set-Cookie", `token=x; Secure; HttpOnly; Expires=${new Date(0).toUTCString()}`);
	res.header("Location", "/login");
	return res.send("");
});


// Run the server and report out to the logs
fastify.listen(
	{ port: 3000, host: "127.0.0.1" },
	(err, address) => {
		if (err) {
			console.error(err);
			process.exit(1);
		}
		console.log(`Your app is listening on ${address}`);
	}
);