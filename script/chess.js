const db = firebase.database()

const movePath = 'url("../assets/chess/move.png")'
const moveColor = "#00b2ff"
const size = 100
const x = ["a", "b", "c", "d", "e", "f", "g", "h"]
const y = ["8", "7", "6", "5", "4", "3", "2", "1"]
const askDrawMessage = " demande la nulle. Accepter ?"
const offPieces = new Array

let mode = -1
let level = 1
let pat = false
let mat = false
let ended = false
let gameReady = false
let lastMoveForward = false
let pseudo = new String()
let gameKey = new String()
let game = new Array
let eaten = new Array
let pieces = new Array
let lastMoves = new Array
let logs = new Map()
let selected = new Map()
let players = new Map()
let waitingForValidMove = new Map()

let scores = new Map().set("w", 0).set("b", 0)
let castling = new Map().set("qside", new Array).set("kside", new Array).set("kings", new Array)
let turns = new Map().set("w", 1).set("b", -1).set("current", -1).set("move", 1)
let names = new Map().set("pawn", ["pion", new String(), 1])
	.set("knight", ["cavalier", "N", 3])
	.set("bishop", ["fou", "B", 3])
	.set("rook", ["tour", "R", 5])
	.set("queen", ["dame", "Q", 9])
	.set("king", ["roi", "K", 0])

document.body.className = new String()
document.body.addEventListener("keydown", onKeyDown)

do {
	pseudo = prompt("Choisissez un pseudo")
} while (!pseudo || pseudo.length == 0 || pseudo == "Robot")

document.getElementById("player").innerText = pseudo

/**
 * Changer le thème du plateau
 * @param {object} select Boîte sélective de thèmes
 */
function setTheme(select) {
	let value = select.value

	for (let element of document.getElementsByClassName("case")) {
		if (!element.className.includes("white")) {
			element.className = "case " + value
		}
	}
}

/**
 * Faire disparaître le header
 */
function dismissHeader() {
	document.body.removeChild(document.getElementById("header"))
}

/**
 * Focus la zone de texte lorsqu'une lettre est tapée ou envoyer si Entrée est tapé
 * @param {object} event Evenement généré lors d'un appui
 */
function onKeyDown(event) {
	let input = document.getElementById("content")

	if (input != document.activeElement && event.keyCode >= 65 && event.keyCode <= 90) {
		input.focus()
	} else if (input == document.activeElement && event.key == "Enter" && input.value.trim().length != 0) {
		sendMessage()
	}
}

/**
 * Supprimer une pièce dans le mode édition lors d'un clique droit
 * @param {object} event Evenement généré lors d'un clique
 */
function onMouseDown(event) {
	if (mode == 3 && event.button == 2) {
		let piece = pieces.find(p => p.get("id") == event.target.id)
		if (piece) {
			let coords = getCoords(piece.get("id"))
			pieces.splice(pieces.indexOf(piece), 1)
			game[coords.get("y")][coords.get("x")].set("piece", false)
			update()
		}
	}
}

/**
 * Envoyer un message
 */
function sendMessage() {
	let input = document.getElementById("content")

	if (input.value.trim().length != 0) {
		let key = db.ref("games").child(gameKey).child("messages").push().key
		db.ref("games").child(gameKey).child("messages").child(key).update({
			"author": pseudo,
			"content": input.value
		})
	}

	input.value = ""
}

/**
 * Activer l'écouteur d'adversaire
 */
function receiveOpponent() {
	db.ref("games").child(gameKey).child("players").on("value", snapshot => {
		if (!snapshot.val()) return;

		players = new Map(Object.keys(snapshot.val()).map(v => [v, snapshot.val()[v]]))

		let keys = Array.from(players.keys())

		if (keys.length == 2) {
			document.getElementById("opponent").innerText = keys[keys.indexOf(pseudo) * -1 + 1]
			gameReady = true
			update(players.get(pseudo), true)
			db.ref("games").child(gameKey).child("players").off("value")
		}
	})
}

/**
 * Activer l'écouteur de mouvements
 */
function receiveMoves() {
	db.ref("games").child(gameKey).child("moves").on("child_added", snapshot => {
		if (!snapshot.val()) return;

		let move = snapshot.val()
		getData(move["from"], move["to"], move["castle"], move["promotion"], move["enpassant"])
	})
}

/**
 * Activer l'écouteur d'actions
 */
function receiveActions() {
	db.ref("games").child(gameKey).child("actions").on("value", snapshot => {
		if (!snapshot.val()) return;

		let value = snapshot.val()

		let keys = Array.from(players.keys())

		if (value["abandon"]) {
			stopGame(2, value["abandon"] == pseudo ? keys[keys.indexOf(pseudo) * -1 + 1] : pseudo)
		} else if (value["nulle"] !== undefined) {
			if (typeof value["nulle"] == "string") {
				if (value["nulle"] != pseudo) {
					db.ref("games").child(gameKey).child("actions").child("nulle").set(confirm(value["nulle"] + askDrawMessage))
				} else {
					document.body.className = "waiting"
				}
			} else if (typeof value["nulle"] == "boolean") {
				document.body.className = ""

				if (value["nulle"]) {
					stopGame(0)
				} else {
					alert("Nulle refusée")
				}
			}
		}
	})
}

/**
 * Activer l'écouteur de messages
 */
function receiveMessages() {
	db.ref("games").child(gameKey).child("messages").on("child_added", snapshot => {
		if (!snapshot.val()) return;

		let message = snapshot.val()
		let label = document.createElement("label")
		label.className = "message"
		label.innerHTML = "<b>" + message["author"] + " -</b> " + message["content"]

		document.getElementById("messages").appendChild(label)
	})
}

// Afin d'optimiser, essayer de réduire au maximum les boucles (par exemple, dans le check du setMove, on n'a besoin que des pièces de l'adversaire)

/**
 * Générer un pseudo
 * @param {number=} length Longueur du pseudo
 * @returns {string} Pseudo généré de façon aléatoire dans tous les sens du terme
 */
function getPseudo(length = Math.floor(Math.random() * 5 + 5)) {
	let all = new Array
	for (let i = 0; i < 26; all.push(String.fromCharCode(65 + i++)));

	let res = all[Math.floor(Math.random() * all.length)]
	let letters = new Map().set("vowels", ["A", "E", "I", "O", "U", "Y"])
	letters.set("consonants", all.filter(l => !letters.get("vowels").includes(l)))

	let keys = Array.from(letters.keys())

	for (let i = 1; i < length; i++) {
		let next = letters.get(keys[keys.indexOf(keys.find(key => letters.get(key).includes(res[i - 1]))) * -1 + 1])
		let same = letters.get(keys.find(key => letters.get(key).includes(res[i - 1])))

		for (let j = 0; j < same.length; Math.floor(Math.random() * 100) < 100 / same.length ? next.push(same[j++]) : j++);

		res += next[Math.floor(Math.random() * next.length)]
	}

	res = res.charAt(0) + res.slice(1).toLowerCase()

	if (res == pseudo) res = getPseudo()

	return res
}

/**
 * Réinitialiser toutes les variables
 */
function resetAll() {
	game = getPositionFromPieces(offPieces)
	pieces = offPieces.map(p => new Map(p))

	mode = -1
	level = 1
	pat = false
	mat = false
	ended = false
	gameReady = false
	lastMoveForward = false
	gameKey = new String()
	eaten = new Array
	lastMoves = new Array
	logs = new Map()
	selected = new Map()
	players = new Map()
	waitingForValidMove = new Map()
	turns.set("current", 1)
	turns.set("move", 1)

	scores = new Map().set("w", 0).set("b", 0)

	castling = scores.set("qside", new Array).set("kside", new Array).set("kings", new Array)

	let content = document.getElementById("content")
	content.value = ""
	content.disabled = true
}

/**
 * Connecter l'utilisateur à une partie
 * @param {number} type Type de la connexion (locale, IA, en ligne)
 */
function connect(type) {
	if (mode == -1) {
		clearLogs()

		if (type == 2) document.getElementById("content").disabled = false

		if (type == 2 && db.ref("games")) {
			db.ref("games").once("value", snapshot => {
				for (let key in snapshot.val()) {
					if (Object.keys(snapshot.val()[key]["players"]).length == 1) {
						return gotoGame(key)
					}
				}

				startGame(type)
			})
		} else startGame(type)
	} else alert("Une partie est déjà en cours !")
}

/**
 * Lancer une partie
 * @param {number} type 0 : partie locale | 1 : partie contre IA | 2 : partie en ligne
 */
async function startGame(type) {
	mode = type

	let color = Math.floor(Math.random() * Math.floor(100)) < 50 ? "white" : "black"

	switch (type) {
		case 0:
			update("white", true)

			let opponent = getPseudo()
			document.getElementById("opponent").innerText = opponent

			players.set(pseudo, "w")
			players.set(opponent, "b")
			break

		case 1:
			document.getElementById("opponent").innerText = "Robot"
			document.getElementById("nobot").style.display = "none"

			players.set(pseudo, color)
			players.set("Robot", color == "white" ? "black" : "white")

			do {
				level = parseInt(prompt("Entrez le niveau du bot [1 - 3] :"))
			} while (level < 1 || level > 3)

			update(color, true)
			break

		case 2:
			players.set(pseudo, color)

			let key = db.ref("games").push().key
			gameKey = key
			
			db.ref("games").child(key).update({
				"players": Object.fromEntries(players)
			})

			update(color, true)
			receiveOpponent()
			receiveMoves()
			receiveActions()
			receiveMessages()
			break
	}
}

/**
 * Terminer une partie
 * @param {number} result Type de fin de partie (nul, mat, abandon)
 * @param {string=} winner Vainqueur de la partie
 */
function stopGame(result, winner = Array.from(players.keys()).find(player => turns.get("current") != turns.get(players.get(player).charAt(0)))) {
	if (result == 1 || result == 2) {
		alert(winner + " a gagné par " + (result == 1 ? "mat" : "abandon") + " !")
	} else if (result == 0) {
		alert("Egalité !")
	} else throw new Error("Résultat indeterminable : " + result)

	for (let input of document.getElementsByClassName("idle")) input.style.display = "inline-block"
	for (let input of document.getElementsByClassName("play")) input.style.display = "none"
	for (let input of document.getElementsByClassName("editor")) input.style.display = "none"

	if (mode == 2) {
		db.ref("games").child(gameKey).child("moves").off("child_added")
		db.ref("games").child(gameKey).child("messages").off("child_added")
		db.ref("games").child(gameKey).child("actions").off("value")
	}

	resetAll()
}

/**
 * Initialiser le jeu avec une partie en attente
 * @param {string} id Clé de partie
 */
function gotoGame(id) {
	db.ref("games").child(id).once("value", snapshot => {
		let game = snapshot.val()
		console.log(game)
		let color = game["players"][Object.keys(game["players"])[0]] == "white" ? "black" : "white"
		players = new Map(Object.keys(game["players"]).map(player => [player, game["players"][player]])).set(pseudo, color)
		players.set(Object.keys(game["players"])[0], color == "white" ? "black" : "white")
		db.ref("games").child(id).child("players").update(Object.fromEntries(players))

		document.getElementById("opponent").innerText = Object.keys(game["players"])[0]

		gameKey = id
		gameReady = true
		mode = 2
		console.log(players)
		update(color, true)
		receiveMoves()
		receiveActions()
		receiveMessages()
	})
}

/**
 * Envoie les mouvements données à la base de données
 * @param {object} from Case incluant piece, id
 * @param {object} to Case incluant piece, id
 * @param {boolean} castle Roque effectué ?
 * @param {boolean|string} promotion Pion à promotion
 * @param {boolean} enpassant Prise en passant
 */
function sendData(from, to, castle, promotion, enpassant) {
	db.ref("games").child(gameKey).child("moves").push().update({
		"from": Object.fromEntries(from),
		"to": Object.fromEntries(to),
		"castle": castle,
		"promotion": promotion,
		"enpassant": enpassant
	})
}

/**
 * Recevoir les données en ligne
 * @param {number} from Case incluant piece, id
 * @param {number} to Case incluant piece, id
 * @param {boolean} castle Roque effectué ?
 * @param {boolean|string} promotion Pion à promotion
 * @param {boolean} enpassant Prise en passant
 */
function getData(from, to, castle, promotion, enpassant) {
	from = new Map(Object.keys(from).map(key => [key, from[key]]))
	to = new Map(Object.keys(to).map(key => [key, to[key]]))

	let fromCoords = getCoords(from.get("id"))
	let toCoords = getCoords(to.get("id"))

	if (castle && pieces.find(e => e.get("id") == from.get("id"))) {
		setCastling(from, to)
	} else {
		if (pieces.find(e => e.get("id") == from.get("id"))) {
			let exist = new Map(pieces.find(e => e.get("id") == to.get("id")))
			let newPiece = new Map(to).set("piece", promotion ? promotion : from.get("piece"))

			if (exist.get("piece")) pieces.splice(pieces.indexOf(pieces.find(e => e.get("id") == to.get("id"))), 1)

			pieces.splice(pieces.indexOf(pieces.find(e => e.get("id") == from.get("id"))), 1)
			pieces.push(newPiece)

			if (to.get("id") == from.get("id") + 16 * -turns.get(from.get("piece").charAt(0)) && from.get("piece").slice(1) == "pawn") {
				lastMoveForward = true
			} else lastMoveForward = false

			if (enpassant) setEnPassant(from, to)

			game[toCoords.get("y")][toCoords.get("x")] = newPiece
			game[fromCoords.get("y")][fromCoords.get("x")].set("piece", false).set("id", from.get("id"))
		}
	}

	setLogs(from, to, castle, promotion, enpassant)

	if (from.get("piece").charAt(0) == "b") turns.set("move", turns.get("move") + 1)

	lastMoves = [from.get("id"), to.get("id")]
	selected = new Map()
	update()
}

/**
 * Demander la nulle
 */
function askDraw() {
	if (mode == 0) {
		if (confirm((turns.get("current") == 1
			? pseudo
			: document.getElementById("opponent").innerText) + askDrawMessage)) {
			stopGame(0)
		} else {
			alert("Nulle refusée")
		}
	} else if (mode == 2) {
		db.ref("games").child(gameKey).child("actions").update({
			"nulle": pseudo
		})
	} else throw new Error("Aucune partie en cours")
}

/**
 * Abandonner
 */
function resign() {
	if (mode == 2) {
		db.ref("games").child(gameKey).child("actions").update({
			"abandon": pseudo
		})
	} else stopGame(2, Array.from(players.keys()).find(p => turns.get("current") != turns.get(players.get(p).charAt(0))))
}

/**
 * Trouver un coup
 * @param {number} depth Profondeur de recherche
 * @returns {array} Tableau du meilleur mouvement
 */
function findMove(depth) {
	if (depth > 10) throw new Error("Profondeur trop importante")

	let contextGame = game.map(row => row.map(p => new Map(p)))
	let contextPieces = pieces.map(p => new Map(p))
	let contextTurn = turns.get("current")
	let bestMove = [new Map(), 0, Infinity]

	function localMove(from, to) {
		let fromCoords = getCoords(from.get("id"))
		let toCoords = getCoords(to.get("id"))

		if (game[fromCoords.get("y")][fromCoords.get("x")].get("piece") != from.get("piece")) return
		if (to.get("piece")) pieces.splice(pieces.indexOf(pieces.find(e => e.get("id") == to.get("id"))), 1)

		game[fromCoords.get("y")][fromCoords.get("x")].set("piece", false)
		game[toCoords.get("y")][toCoords.get("x")].set("piece", from.get("piece"))

		pieces.splice(pieces.indexOf(pieces.find(e => e.get("id") == from.get("id"))), 1)
		pieces.push(new Map(from).set("id", to.get("id")))

		contextTurn *= -1

		cleanPieces()
	}

	function alphabeta(alpha, beta, depthAB, isMax) {
		let turnTo = Array.from(turns.keys()).find(t => turns.get(t) == contextTurn)

		if (depthAB == 0) return evalPosition(pieces, turnTo)

		let iterator = getPiecesMovements(turnTo)
		let piece = new Map()

		for (;;) {
			let value = iterator.next().value

			if (!value) break

			if (typeof value == "object") {
				piece = new Map(value)
			} else {
				let coords = getCoords(value)
				let pieceCoords = getCoords(piece.get("id"))
				let uneat = new Map(game[coords.get("y")][coords.get("x")])
				let score = 0

				localMove(piece, new Map().set("piece", game[coords.get("y")][coords.get("x")].get("piece")).set("id", value))

				let check = isCheck()

				if (typeof check == "number" && check == 1 && turnTo == turns.get(players.get("Robot").charAt(0))) {
					bestMove = [currentPiece, value, Infinity * contextTurn]
				} else {
					score = alphabeta(alpha, beta, depthAB - 1, !isMax)
				}

				localMove(new Map(piece).set("id", value), new Map(piece).set("piece", game[pieceCoords.get("y")][pieceCoords.get("x")].get("piece")))

				if (uneat.get("piece")) {
					game[coords.get("y")][coords.get("x")] = uneat
					pieces.push(uneat)
				}

				if (isMax) {
					if (score >= beta) return beta
					if (score > alpha) alpha = score
				} else {
					if (score <= alpha) return alpha
					if (score < beta) beta = score
				}
			}
		}

		return (isMax ? alpha : beta)
	}

	let currentIterator = getPiecesMovements(Array.from(turns.keys()).find(t => turns.get(t) == turns.get("current")))
	let currentPiece = new Map()

	for (;;) {
		let value = currentIterator.next().value

		if (!value) break

		if (typeof value == "object") {
			currentPiece = new Map(value)
		} else {
			let coords = getCoords(value)
			let pieceCoords = getCoords(currentPiece.get("id"))
			let uneat = new Map(game[coords.get("y")][coords.get("x")])

			if (!game[pieceCoords.get("y")][pieceCoords.get("x")].get("piece")) continue

			localMove(currentPiece, new Map().set("piece", game[coords.get("y")][coords.get("x")].get("piece")).set("id", value))

			let check = isCheck()

			if (typeof check == "number" && check == 1) {
				bestMove = [currentPiece, value, 0]
			} else {
				let currentScore = alphabeta(-Infinity, Infinity, depth - 1, false)

				if (currentScore <= bestMove[2]) {
					bestMove[0] = currentPiece
					bestMove[1] = value
					bestMove[2] = currentScore
				}
			}

			localMove(new Map(currentPiece).set("id", value), new Map(currentPiece).set("piece", game[pieceCoords.get("y")][pieceCoords.get("x")].get("piece")))

			if (uneat.get("piece")) {
				game[coords.get("y")][coords.get("x")] = uneat
				pieces.push(uneat)
			}
		}
	}

	console.log(bestMove)

	pieces = contextPieces
	game = contextGame

	return bestMove
}

/**
 * Evaluer une position
 * @param {array} all Tableau de pièces incluant piece, id
 * @param {string} turn Trait aux blancs ou aux noirs
 * @returns {number} Résultat de l'évaluation
 */
function evalPosition(all, turn) {
	// Principes fondamentaux : matériel, développement, contrôle du centre, sécurité du roi, structure de pions
	cleanPieces()

	let check = isCheck()

	let res = new Map().set("w", 0).set("b", 0)

	if (typeof check == "number" && check == 1) {
		res.set(turn, res.get(turn) + 9999)
		return res.get("w") - res.get("b")
	} else if (typeof check == "object" && check.length != 0) {
		res.set(turn, res.get(turn) + 200)
	}

	/*let values = {
		"wpawns": [
			[0, 0, 0, 0, 0, 0, 0, 0],
			[50, 50, 50, 50, 50, 50, 50, 50],
			[10, 10, 20, 30, 30, 20, 10, 10],
			[5, 5, 10, 25, 25, 10, 5, 5],
			[0, 0, 0, 20, 20, 0, 0, 0],
			[5, -5, -10,  0,  0, -10, -5, 5],
			[5, 10, 10, -20, -20, 10, 10, 5],
			[0, 0, 0, 0, 0, 0, 0, 0]
		],
		"wknights": [
			[-50, -40, -30, -30, -30, -30, -40, -50],
			[-40, -20, 0, 0, 0, 0, -20, -40],
			[-30, 0, 10, 15, 15, 10, 0, -30],
			[-30, 5, 15, 20, 20, 15, 5, -30],
			[-30, 0, 15, 20, 20, 15, 0, -30],
			[-30, 5, 10, 15, 15, 10, 5, -30],
			[-40, -20, 0, 5, 5, 0, -20, -40],
			[-50, -40, -30, -30, -30, -30, -40, -50]
		],
		"wbishops": [
			[-20, -10, -10, -10, -10, -10, -10, -20],
			[-10, 0, 0, 0, 0, 0, 0, -10],
			[-10, 0, 5, 10, 10, 5, 0, -10],
			[-10, 5, 5, 10, 10, 5, 5, -10],
			[-10, 0, 10, 10, 10, 10, 0, -10],
			[-10, 10, 10, 10, 10, 10, 10, -10],
			[-10, 5, 0, 0, 0, 0, 5,-10],
			[-20, -10, -10, -10, -10, -10, -10, -20]
		],
		"wrooks": [
			[0, 0, 0, 0, 0, 0, 0, 0,],
			[5, 10, 10, 10, 10, 10, 10, 5],
			[-5, 0, 0, 0, 0, 0, 0, -5],
		    [-5, 0, 0, 0, 0, 0, 0, -5],
			[-5, 0, 0, 0, 0, 0, 0, -5],
			[-5, 0, 0, 0, 0, 0, 0, -5],
			[-5, 0, 0, 0, 0, 0, 0, -5],
			[0, 0, 0, 5, 5, 0, 0, 0]
		],
		"wqueens": [
			[-20, -10, -10, -5, -5, -10, -10, -20],
			[-10, 0, 0, 0, 0, 0, 0, -10],
			[-10, 0, 5, 5, 5, 5, 0, -10],
			[-5, 0, 5, 5, 5, 5, 0, -5],
			[0, 0, 5, 5, 5, 5, 0, -5],
			[-10, 5, 5, 5, 5, 5, 0,-10],
			[-10, 0, 5, 0, 0, 0, 0,-10],
			[-20, -10, -10, -5, -5, -10, -10, -20]
		],
		"wkings": [
			[-30, -40, -40, -50, -50, -40, -40, -30],
			[-30, -40, -40, -50, -50, -40, -40, -30],
			[-30, -40, -40, -50, -50, -40, -40, -30],
			[-30, -40, -40, -50, -50, -40, -40, -30],
			[-20, -30, -30, -40, -40, -30, -30, -20],
			[-10, -20, -20, -20, -20, -20, -20, -10],
			[20, 20, 0, 0, 0, 0, 20, 20],
			[20, 30, 10, 0, 0, 10, 30, 20]
		]
	}
	
	values["bpawns"] = values["wpawns"].reverse().map(r => [...r])
	values["bknights"] = values["wknights"].reverse().map(r => [...r])
	values["bbishops"] = values["wbishops"].reverse().map(r => [...r])
	values["brooks"] = values["wrooks"].reverse().map(r => [...r])
	values["bqueens"] = values["wqueens"].reverse().map(r => [...r])
	values["bkings"] = values["wkings"].reverse().map(r => [...r])*/

	let center = [27, 28, 35, 36]
	let excenter = [18, 19, 20, 21, 26, 29, 34, 37, 42, 43, 44, 45]

	let moves = {
		"w": new Array,
		"b": new Array
	}

	let bishopPair = {
		"w": 0,
		"b": 0
	}

	for (let piece of all) {
		let possibleMoves = getMoves(piece, false, true)

		if (piece.get("piece").slice(1) == "bishop") bishopPair[piece.get("piece").charAt(0)] += 1

		res.set(piece.get("piece").charAt(0), res.get(piece.get("piece").charAt(0)) + names.get(piece.get("piece").slice(1))[2])
		moves[piece.get("piece").charAt(0)].push(...possibleMoves)
	}

	if (bishopPair["w"] == 2) res.set("w", res.get("w") + 1)
	if (bishopPair["b"] == 2) res.set("b", res.get("b") + 1)

	for (let color of Array.from(res.keys())) {
		res.set(color, res.get(color) + moves[color].reduce((acc, value) => {
			if (center.includes(value)) {
				return acc += 50
			} else if (excenter.includes(value)) {
				return acc += 20
			} else return acc
		}, 0))
	}

	return res.get("w") - res.get("b")
}

/**
 * Lancer l'éditeur de position
 */
function launchEditor() {
	for (let input of document.getElementsByClassName("idle")) input.style.display = "none"
	for (let input of document.getElementsByClassName("play")) input.style.display = "none"
	for (let input of document.getElementsByClassName("editor")) input.style.display = "inline-block"

	document.getElementById("infos").style.display = "none"
	document.getElementById("editor").style.display = "flex"

	mode = 3
	update()
}

/**
 * Réinitialiser l'éditeur
 */
function resetEditor() {
	resetAll()
	update()
}

/**
 * Quitter l'éditeur
 */
function leaveEditor() {
	resetAll()
	clearLogs()
	update()
	turns.set("current", 1)
	mode = -1

	document.getElementById("infos").style.display = "block"
	document.getElementById("editor").style.display = "none"

	for (let input of document.getElementsByClassName("idle")) input.style.display = "inline-block"
	for (let input of document.getElementsByClassName("play")) input.style.display = "none"
	for (let input of document.getElementsByClassName("editor")) input.style.display = "none"
}

/**
 * Initialiser le terrain
 */
function init() {
	let id = 0

	for (let i = 0; i < 64; i++) {
		let row = Math.floor(i / 8)
		let pushed = new Map().set("piece", false).set("id", id)

		if (!game[row]) game[row] = new Array

		switch (row) {
			case 0:
				switch (i % 8) {
					case 7:
					case 0:
						pushed.set("piece",  "brook")
						break

					case 6:
					case 1:
						pushed.set("piece", "bknight")
						break

					case 5:
					case 2:
						pushed.set("piece", "bbishop")
						break

					case 3:
						pushed.set("piece", "bqueen")
						break

					case 4:
						pushed.set("piece", "bking")
						break
				}

				break

			case 1:
				pushed.set("piece", "bpawn")
				break

			case 6:
				pushed.set("piece", "wpawn")
				break

			case 7:
				switch (i % 8) {
					case 7:
					case 0:
						pushed.set("piece", "wrook")
						break

					case 6:
					case 1:
						pushed.set("piece", "wknight")
						break

					case 5:
					case 2:
						pushed.set("piece", "wbishop")
						break

					case 3:
						pushed.set("piece", "wqueen")
						break

					case 4:
						pushed.set("piece", "wking")
						break
				}

				break
		}

		let cell = document.createElement("div")
		cell.id = pushed.get("id")
		cell.className = "case " + (i % 2 + row % 2 == 1 ? "classic" : "white")
		cell.ondrop = e => onDrop(e)
		cell.ondragover = e => onDragOver(e)
		cell.ondragstart = e => onDragStart(e)
		cell.onclick = () => onClicked(pushed.get("id"))
		cell.draggable = false

		if (i % 8 == 0) {
			let aff = document.createElement("label")
			aff.className = "aff"
			aff.left = "0px"
			aff.top = "0px"
			aff.innerText = y[row]
			cell.appendChild(aff)
		}

		if (row == 7) {
			let aff = document.createElement("label")
			aff.className = "aff"
			aff.right = "0px"
			aff.bottom = "0px"
			aff.innerText = x[i % 8]
			cell.appendChild(aff)
		}

		document.getElementById("board").appendChild(cell)

		id++

		game[row].push(pushed)

		if (id % 8 == 0) {
			document.getElementById("board").appendChild(document.createElement("br"))
		}
	}

	for (let line of game) for (let p of line) if (p.get("piece")) {
		let piece = p.get("piece").slice(1)

		offPieces.push(new Map(p))

		if (piece == "rook" || piece == "king") {
			if (line.indexOf(p) == 0) {
				castling.get("qside").push([p.get("id"), p.get("piece")])
			} else if (line.indexOf(p) == 7) {
				castling.get("kside").push([p.get("id"), p.get("piece")])
			} else castling.get("kings").push([p.get("id"), p.get("piece")])
		}
	}

	pieces = offPieces.map(p => new Map(p))

	update("white")
}

init()

/**
 * Mettre à jour le terrain
 * @param {string=} side Définir un sens à mettre à jour
 * @param {boolean=} init Initialiser un terrain ou non
 * @param {boolean=} turnGame Tourner le plateau et ignorer la vérification d'échecs
 */
function update(side = players.get(pseudo), init = false, turnGame = false) {
	hideMoves()

	let check = isCheck()

	if (!turnGame) {
		if (!init) {
			if (mode != 3) {
				if (pat) {
					return stopGame(0)
				} else if (mat) {
					return stopGame(1, Array.from(players.keys()).find(player => turns.get("current") == turns.get(players.get(player).charAt(0))))
				}
	
				turns.set("current", (turns.get("current") * -1))
			}
		} else {
			for (let input of document.getElementsByClassName("idle")) input.style.display = "none"
			for (let input of document.getElementsByClassName("play")) input.style.display = "inline-block"
			for (let input of document.getElementsByClassName("editor")) input.style.display = "none"
		}
	}

	for (let y in game) {
		for (let x in game[y]) {
			let div = document.getElementById(game[y][x].get("id").toString())
			div.style.backgroundImage = (game[y][x].get("piece") ? "url('../assets/chess/" + game[y][x].get("piece") + ".png')" : null)

			if (game[y][x].get("piece") && turns.get("current") == turns.get(game[y][x].get("piece").charAt(0)) && mode != 3) {
				if (mode == 0 || ((mode == 2 || mode == 1) && players.get(pseudo).charAt(0) == game[y][x].get("piece").charAt(0))) {
					div.draggable = true
				}
			} else {
				if (mode == 3) {
					div.draggable = true
				} else {
					div.draggable = false
				}
			}

			if (side == "black") div.style.transform = "scaleY(-1) scaleX(-1)"
			if (side == "white" && div.style.transform == "scaleY(-1) scaleX(-1)") div.style.transform = ""

			if (typeof check == "object" && check.some(k => k.get("id") == game[y][x].get("id"))) {
				div.style.border = "5px solid red"
			} else {
				div.style.border = "0"
			}

			if (lastMoves[0] == div.id) {
				div.style.backgroundColor = "#e3c57888"
			} else if (lastMoves[1] == div.id) {
				div.style.backgroundColor = "#ffe7ab88"
			} else {
				div.style.backgroundColor = ""
			}
		}
	}

	if (side == "black") document.getElementById("board").style.transform = "scaleY(-1) scaleX(-1)"
	if (side == "white" && document.getElementById("board").style.transform == "scaleY(-1) scaleX(-1)") document.getElementById("board").style.transform = ""

	if (mode == 1 && turns.get("current") == turns.get(players.get("Robot").charAt(0)) && !turnGame) {
		setTimeout(() => {
			let move = findMove(level)
			let moveCoords = getCoords(move[1])

			console.log(move)

			setMove(new Map(move[0]), new Map(game[moveCoords.get("y")][moveCoords.get("x")])).then(res => {
				console.log("Passé", res)
				if (game[moveCoords.get("y")][moveCoords.get("x")].get("piece").charAt(0) == "b") turns.set("move", turns.get("move") + 1)

				lastMoves = [move[0].get("id"), move[1]]
				selected = new Map()

				update()
			}).catch(err => {
				console.log("Erreur", err)
			})
		})
	}
}

/**
 * Initialiser un terrain selon une position donnée
 * @param {array} all Répertoire de pièces
 * @returns {array} Terrain
 */
function getPositionFromPieces(all) {
	let board = new Array

	for (let i = 0; i < 64; i++) {
		let y = Math.floor(i / 8)
		let already = new Map(all.find(p => i == p.get("id")))

		if (!board[y]) board[y] = new Array

		if (already.size != 0) {
			board[y].push(already)
		} else {
			board[y].push(new Map().set("piece", false).set("id", i))
		}
	}

	return board
}

/**
 * Retire les doublons de pieces
 */
function cleanPieces() {
	pieces = Array.from(new Set(pieces))

	/*for (let piece in pieces) {
		if (!pieces.get(piece).get("piece")) {
			pieces.splice(piece, 1)
		}
	}*/
}

/**
 * Evenement lors d'un click sur une case
 * @param {number} id ID de la case cliquée
 * @param {boolean=} dropped Afficher l'animation du mouvement
 */
function onClicked(id, dropped = false) {
	let coords = getCoords(id)
	let cell = game[coords.get("y")][coords.get("x")]

	if ((mode == -1 || ended || (mode == 2 && !gameReady))
		|| (mode == 2 && turns.get(players.get(pseudo).charAt(0)) != turns.get("current"))) return;

	if (mode == 3 && selected.size != 0) {
		let selectedCoords = getCoords(selected.get("id"))
		game[coords.get("y")][coords.get("x")].set("piece", selected.get("piece"))
		game[selectedCoords.get("y")][selectedCoords.get("x")].set("piece", false)

		pieces.splice(pieces.indexOf(pieces.find(p => p.get("id") == selected.get("id"))), 1)
		pieces.push(game[coords.get("y")][coords.get("x")])
		selected = new Map()

		cleanPieces()
		update()
		return;
	}

	let previous = new Map(selected)
	let nextious = new Map(cell)
	let contextPieces = pieces.map(p => new Map(p))
	let contextGame = game.map(r => r.map(p => new Map(p)))

	if (selected.size != 0 && selected != cell && selected.get("piece") && selected.get("piece").slice(1) == "king" && cell.get("piece") && castle(selected).includes(cell.get("id")) && mode != 3) {
		setCastling(selected, cell)

		if (mode == 2) {
			sendData(previous, nextious, true, false, false)
		} else {
			setLogs(previous, nextious, true)

			if (previous.get("piece").charAt(0) == "b") turns.set("move", turns.get("move") + 1)

			lastMoves = [previous.get("id"), nextious.get("id")]
			selected = new Map()

			update()
		}
	} else if (selected.get("id") != cell.get("id") && cell.get("piece") != false && turns.get(cell.get("piece").charAt(0)) == turns.get("current") && !dropped) {
		selected = new Map(cell)
		hideMoves()
		showMoves(cell)
	} else if (selected.size != 0 && Array.from(getPiecesMovements(false, false, selected.get("id"))).filter(value => typeof value == "number").some(e => e == cell.get("id")) && mode != 3) {
		setMove(previous, nextious).then(res => {
			if (mode == 2) {
				sendData(previous, nextious, false, (typeof res == "string" ? res : false), (typeof res == "boolean" ? res : false))
			} else {
				if (previous.get("piece").charAt(0) == "b") turns.set("move", turns.get("move") + 1)

				lastMoves = [previous.get("id"), nextious.get("id")]
				selected = new Map()

				update()
			}
		}).catch(err => {
			console.log(err)

			pieces = contextPieces
			game = contextGame

			document.getElementById(selected.get("id")).style.backgroundImage = "url('../assets/chess/" + selected.get("piece") + ".png')"
		})
	} else {
		if (selected.get("id")) {
			document.getElementById(selected.get("id")).style.backgroundImage = "url('../assets/chess/" + selected.get("piece") + ".png')"
		}
	}
}

/**
 * Jouer une pièce droppée
 * @param {object} event Evenement généré lorsqu'un pion est droppé
 */
function onDrop(event) {
	event.preventDefault()

	let data = event.dataTransfer.getData("text")

	if (data) {
		let coords = getCoords(event.target.id)

		if (game[coords.get("y")][coords.get("x")].get("piece")) pieces.splice(pieces.indexOf(pieces.find(p => p.get("id") == event.target.id)), 1)

		game[coords.get("y")][coords.get("x")].set("piece", data)
		pieces.push(new Map().set("piece", data).set("id", parseInt(event.target.id)))

		cleanPieces()
		update()
	} else if (event.target.id == selected.get("id")) {
		document.getElementById(selected.get("id")).style.backgroundImage = "url('../assets/chess/" + selected.get("piece") + ".png')"
	} else onClicked(event.target.id, true)
}

/**
 * Vérifier qu'une pièce draggée passe sur une case valide
 * @param {object} event Evenement généré continuellement tant que l'utilisateur passe sur une case valide
 */
function onDragOver(event) {
	event.preventDefault()
}

/**
 * Imiter la pièce draggée en pièce cliquée
 * @param {object} event Evenement généré lorsqu'une pièce est draggée
 */
function onDragStart(event) {
	if (mode == -1) {
		return false
	} else if (!event.target.id) {
		let src = event.target.src.split("/")
		let piece = src[src.length - 1]
		event.dataTransfer.setData("text", piece.substring(0, piece.length - 4))
	} else {
		let piece = pieces.find(e => e.get("id") == event.target.id)

		selected = piece
		hideMoves()
		showMoves(selected)

		document.getElementById(selected.get("id")).style.backgroundImage = "none"

		let image = new Image()
		image.src = "../assets/chess/" + piece.get("piece") + ".png"
		event.dataTransfer.setDragImage(image, image.width / 2, image.height / 2)
	}
}

/**
 * Affiche les mouvements disponibles pour une pièce
 * @param {object} cell Case incluant piece, id
 */
function showMoves(cell) {
	let res = Array.from(getPiecesMovements(false, false, cell.get("id"))).filter(value => typeof value == "number")

	for (let id of res) {
		let element = document.getElementById(id.toString())
		let coords = getCoords(id)

		console.log(element.style.backgroundImage)

		if (element.style.backgroundImage.includes("chess/")) {
			element.style.border = "4px solid " + moveColor
		} else {
			element.style.backgroundImage += movePath
		}
	}
}

/**
 * Cacher les mouvements disponibles affichés
 */
function hideMoves() {
	for (let i = 0; i < 64; i++) {
		let element = document.getElementById(i.toString())
		let coords = getCoords(i)

		if (element.style.backgroundImage.startsWith(movePath)) {
			let cell = game[coords.get("y")][coords.get("x")]

			element.style.backgroundImage = cell.get("piece") ? "url('../assets/chess/" + cell.get("piece") + ".png')" : null
		}

		if (element.style.borderColor != "red") element.style.border = "0"
	}
}

/**
 * Récuperer les coordonnées d'une case
 * @param {number} id ID de la case
 * @returns {object} Coordonnées Y et X du tableau game à l'ID voulu
 */
function getCoords(id) {
	return new Map().set("y", Math.floor(id / game.length)).set("x", id % game.length)
}

/**
 * Récupérer une case à partir d'une certaine position avec Y et X de différence
 * @param {number} ref ID de référence
 * @param {number} y Déplacement en ligne
 * @param {number} x Déplacement en colonne
 * @returns {object|null} Case désirée si existante
 */
function getCell(ref, y, x) {
	ref += Math.floor(y * 8) + x

	if (ref < 0) return null

	coords = getCoords(ref)

	if (coords.get("x") >= 8 || coords.get("x") < 0 || coords.get("y") >= 8 || coords.get("y") < 0) return null

	return game[coords.get("y")][coords.get("x")]
}

/**
 * Récupérer les mouvements disponibles pour une pièce dans un contexte
 * @param {object} cell Case incluant piece, id
 * @param {boolean=} castlingCheck Evite la recursivité entre castle(), isCheck() et getMoves()
 * @param {boolean=} context Rajouter aux pions les cases qu'ils menacent pour vérifier si le roi peut s'en approcher
 * @returns {array} Tableau contenant toutes les cases où peut aller la pièce demandée
 */
function getMoves(cell, castlingCheck = true, context = false) {
	let res = new Array

	switch (cell.get("piece").slice(1)) {
		case "pawn":
			// TODO: Utiliser la direction pour optimiser
			let direction = turns.get(cell.get("piece").charAt(0)) * -1
			let row = Math.floor(cell.get("id") / game.length)
			let pawnCells = [getCell(cell.get("id"), direction, 1), getCell(cell.get("id"), direction, -1)]
			let forwardCell = getCell(cell.get("id"), direction, 0)
			let coords = getCoords(cell.get("id"))
			let logsKeys = Array.from(logs.keys())
			let lastLogsArray = logs.get(logsKeys[logsKeys.length - 1])

			for (let ccell of pawnCells) if (ccell) {
				let ccords = getCoords(ccell.get("id"))
				if (ccell.get("piece") && ccell.get("piece").charAt(0) != cell.get("piece").charAt(0) && Math.abs(ccords.get("x") - coords.get("x")) == 1 && Math.abs(ccords.get("y") - coords.get("y")) == 1) res.push(ccell.get("id"))
			}

			if (forwardCell && !forwardCell.get("piece")) res.push(forwardCell.get("id"))

			if ((row == 6 && cell.get("piece").charAt(0) == "w") || (row == 1 && cell.get("piece").charAt(0) == "b")) {
				let extraCell = getCell(cell.get("id"), direction * 2, 0)
				if (extraCell && !extraCell.get("piece") && forwardCell && !forwardCell.get("piece")) res.push(extraCell.get("id"))
			}

			if (context) {
				let leftCoords = getCoords(cell.get("id") + 8 * direction - 1)
				let rightCoords = getCoords(cell.get("id") + 8 * direction + 1)

				if (row - leftCoords.get("x") == 1) res.push(cell.get("id") + 8 * direction - 1)
				if (rightCoords.get("x") - row == 1) res.push(cell.get("id") + 8 * direction + 1)
			}

			if (lastLogsArray && lastLogsArray.length != 0) {
				let lastLog = lastLogsArray[lastLogsArray.length - 1]

				if (lastLog.charAt(1) == y[coords.get("y")] && Math.abs(x.indexOf(lastLog.charAt(0)) - x.indexOf(x[coords.get("x")])) == 1 && lastLog.length == 2 && lastMoveForward) {
					let enpassant = game[coords.get("y") + turns.get(cell.get("piece").charAt(0)) * -1][x.indexOf(lastLog.charAt(0))]
					let epcoords = getCoords(enpassant.get("id"))

					if (Math.abs(coords.get("x") - epcoords.get("x")) == 1) {
						res.push(enpassant.get("id"))
					}
				}
			}

			break

		case "rook":
			res = lineMoves(cell)
			break

		case "knight":
			for (let i = -2; i < 3; i++) {
				for (let j = -2; j < 3; j++) {
					if (Math.abs(i) == Math.abs(j) || i == 0 || j == 0) continue

					let gcell = getCell(cell.get("id"), i, j)

					if (!gcell) continue

					let coords = getCoords(gcell.get("id"))
					let ccoords = getCoords(cell.get("id"))

					if ((!gcell.get("piece") || gcell.get("piece").charAt(0) != cell.get("piece").charAt(0)) && (Math.abs(coords.get("x") - ccoords.get("x")) < 3) && (Math.abs(coords.get("y") - ccoords.get("y")) < 3)) {
						res.push(gcell.get("id"))
					}
				}
			}

			break

		case "bishop":
			res = diagMoves(cell)
			break

		case "queen":
			res.push(...lineMoves(cell))
			res.push(...diagMoves(cell))
			break

		case "king":
			let cells = [
				getCell(cell.get("id"), 1, 1), getCell(cell.get("id"), 1, 0),
				getCell(cell.get("id"), 0, 1), getCell(cell.get("id"), -1, -1),
				getCell(cell.get("id"), -1, 0), getCell(cell.get("id"), 0, -1),
				getCell(cell.get("id"), -1, 1), getCell(cell.get("id"), 1, -1)
			]

			for (let gcell of cells) {
				if (gcell && (!gcell.get("piece") || gcell.get("piece").charAt(0) != cell.get("piece").charAt(0))) {
					let coords = getCoords(cell.get("id"))
					let gCoords = getCoords(gcell.get("id"))

					if (Math.abs(coords.get("y") - gCoords.get("y")) <= 1 && Math.abs(coords.get("x") - gCoords.get("x")) <= 1) {
						res.push(gcell.get("id"))
					}
				}
			}

			if (castlingCheck) {
				let check = isCheck()

				if (typeof check == "object" && check.every(e => e.get("piece") != cell.get("piece").charAt(0) + "king")) {
					res.push(...castle(cell))
				}
			}

			break

		default:
			break
	}

	return Array.from(new Set(res))
}

/**
 * Récupère les mouvements en ligne d'une pièce
 * @param {object} cell Case incluant piece, id
 * @returns {array} Tableau contenant les cases horizontalement et verticalement disponibles
 */
function lineMoves(cell) {
	// Fonctionnel bien que long
	let res = new Array
	let add = [[true, true], [true, true]]
	//         y: -     +  | x: -     +
	let coords = getCoords(cell.get("id"))

	for (let i = 1; i < game.length; i++) {
		if (coords.get("y") - i >= 0 && add[0][0]) {
			if (!game[coords.get("y") - i][coords.get("x")].get("piece")) {
				res.push(game[coords.get("y") - i][coords.get("x")].get("id"))
			} else if (game[coords.get("y") - i][coords.get("x")].get("piece").charAt(0) != cell.get("piece").charAt(0)) {
				res.push(game[coords.get("y") - i][coords.get("x")].get("id"))
				add[0][0] = false
			} else {
				add[0][0] = false
			}
		} else add[0][0] = false

		if (coords.get("y") + i <= 7 && add[0][1]) {
			if (!game[coords.get("y") + i][coords.get("x")].get("piece")) {
				res.push(game[coords.get("y") + i][coords.get("x")].get("id"))
			} else if (game[coords.get("y") + i][coords.get("x")].get("piece").charAt(0) != cell.get("piece").charAt(0)) {
				res.push(game[coords.get("y") + i][coords.get("x")].get("id"))
				add[0][1] = false
			} else {
				add[0][1] = false
			}
		} else add[0][1] = false

		if (coords.get("x") - i >= 0 && add[1][0]) {
			if (!game[coords.get("y")][coords.get("x") - i].get("piece")) {
				res.push(game[coords.get("y")][coords.get("x") - i].get("id"))
			} else if (game[coords.get("y")][coords.get("x") - i].get("piece").charAt(0) != cell.get("piece").charAt(0)) {
				res.push(game[coords.get("y")][coords.get("x") - i].get("id"))
				add[1][0] = false
			} else {
				add[1][0] = false
			}
		} else add[1][0] = false

		if (coords.get("x") + i <= 7 && add[1][1]) {
			if (!game[coords.get("y")][coords.get("x") + i].get("piece")) {
				res.push(game[coords.get("y")][coords.get("x") + i].get("id"))
			} else if (game[coords.get("y")][coords.get("x") + i].get("piece").charAt(0) != cell.get("piece").charAt(0)) {
				res.push(game[coords.get("y")][coords.get("x") + i].get("id"))
				add[1][1] = false
			} else {
				add[1][1] = false
			}
		} else add[1][1] = false
	}

	return res
}

/**
 * Récupère les mouvements en diagonale d'une pièce
 * @param {object} cell Case incluant piece, id
 * @returns {array} Tableau contenant les cases diagonalement disponibles
 */
function diagMoves(cell) {
	let res = new Array
	let add = [true, true, true, true]
	let pieceCoords = getCoords(cell.get("id"))

	for (let i = 1; ; i++) {
		let ncells = [getCell(cell.get("id"), -i, -i), getCell(cell.get("id"), -i, i), getCell(cell.get("id"), i, -i), getCell(cell.get("id"), i, i)]
		let gcells = ncells.filter(e => e != null)

		if (add.some(element => element == true) && gcells.length != 0) {
			for (let ccell of gcells) {
				if (add[ncells.indexOf(ccell)]) {
					let ccoords = getCoords(ccell.get("id"))

					if (Math.abs(pieceCoords.get("x") - ccoords.get("x")) / Math.abs(pieceCoords.get("y") - ccoords.get("y")) == 1) {
						if (ccell.get("piece")) {
							if (ccell.get("piece").charAt(0) != cell.get("piece").charAt(0)) res.push(ccell.get("id"))
							add[ncells.indexOf(ccell)] = false
						} else {
							res.push(ccell.get("id"))
						}
					}
				}
			}
		} else break
	}

	return res
}

/**
 * Récupérer les cases des roques disponibles
 * @param {object} cell Case incluant piece, id
 * @returns {array} Tableau contenant les cases des tours où le roque peut être joué
 */
function castle(cell) {
	let res = new Array

	if (castling.get("kings").some(e => e[0] == cell.get("id"))) {
		if (castling.get("qside").some(e => e[1] == cell.get("piece").charAt(0) + "rook")) {
			let qsidePossible = true

			for (let i = 1; i <= 2; i++) {
				let coords = getCoords(cell.get("id") - i)

				if (game[coords.get("y")][coords.get("x")].get("piece")) {
					qsidePossible = false
					break
				}

				let check = isCheck(new Map(cell).set("id", cell.get("id") - i), cell)

				if (check.some(e => e.get("piece") == cell.get("piece"))) {
					qsidePossible = false
					break
				}
			}

			if (qsidePossible) res.push(castling.get("qside").find(e => e[1] == cell.get("piece").charAt(0) + "rook")[0])
		}

		if (castling.get("kside").some(e => e[1] == cell.get("piece").charAt(0) + "rook")) {
			let ksidePossible = true

			for (let i = 1; i <= 2; i++) {
				let coords = getCoords(cell.get("id") + i)

				if (game[coords.get("y")][coords.get("x")].get("piece")) {
					ksidePossible = false
					break
				}

				let check = isCheck(new Map(cell).set("id", cell.get("id") + i), cell)

				if (check.some(e => e.get("piece") == cell.get("piece"))) {
					ksidePossible = false
					break
				}
			}

			if (ksidePossible) res.push(castling.get("kside").find(e => e[1] == cell.get("piece").charAt(0) + "rook")[0])
		}
	}

	return res
}

/**
 * Effectue un roque
 * @param {object} from Case incluant piece, id
 * @param {object} to Case incluant piece, id
 */
function setCastling(from, to) {
	let kingCoords = getCoords(from.get("id"))
	let rookCoords = getCoords(to.get("id"))
	let newKing = kingCoords.get("x") + 2 * (Math.sign(from.get("id") - to.get("id")) * -1)
	let newRook = rookCoords.get("x") + (from.get("id") - to.get("id") - Math.sign(from.get("id") - to.get("id")))

	game[kingCoords.get("y")][newKing].set("piece", from.get("piece"))
	game[kingCoords.get("y")][kingCoords.get("x")].set("piece", false)

	game[rookCoords.get("y")][newRook].set("piece", game[rookCoords.get("y")][rookCoords.get("x")].get("piece"))
	game[rookCoords.get("y")][rookCoords.get("x")].set("piece", false)

	pieces.splice(pieces.indexOf(pieces.find(e => e.get("id") == from.get("id"))), 1)
	pieces.splice(pieces.indexOf(pieces.find(e => e.get("id") == to.get("id"))), 1)

	pieces.push(game[kingCoords.get("y")][newKing])
	pieces.push(game[rookCoords.get("y")][newRook])
}

/**
 * Effectuer promotion
 * @param {object} cell Case incluant piece, id
 * @returns {promise} Promotion valide ou non
 */
function setPromotion(cell) {
	return new Promise((resolve, reject) => {
		let choices = ["cavalier", "fou", "tour", "dame"]
		let pro = (mode == 1 ? "dame" : prompt("Choisissez une pièce [" + choices.join("/") + "] :").toLowerCase())

		if (!choices.includes(pro)) {
			return reject(false)
		} else {
			let coords = getCoords(cell.get("id"))
			let newPiece = cell.get("piece").charAt(0) + Array.from(names.keys()).find(e => names.get(e)[0] == pro)

			game[coords.get("y")][coords.get("x")].set("piece", newPiece)

			pieces.splice(pieces.indexOf(pieces.find(e => e.get("id") == cell.get("id"))))
			pieces.push(new Map(cell).set("piece", newPiece))

			return resolve(newPiece)
		}
	})
}

/**
 * Effectuer un enpassant
 * @param {object} from Case incluant piece, id
 * @param {object} to Case incluant piece, id
 */
function setEnPassant(from, to) {
	let ptd = new Map(pieces.find(p => p.get("id") == getCell(to.get("id"), turns.get(from.get("piece").charAt(0)), 0).get("id")))
	let coords = getCoords(ptd.get("id"))
	game[coords.get("y")][coords.get("x")].set("piece", false)
	eat(ptd)
}

/**
 * Déplacer une pièce
 * @param {object} from Case d'origine incluant piece, id
 * @param {object} to Case d'arrivée incluant piece, id
 * @returns {promise} Mouvement valide ou non
 */
function setMove(from, to) {
	return new Promise((resolve, reject) => {
		let projected = new Map().set("piece", from.get("piece")).set("id", to.get("id"))
		let coords = getCoords(projected.get("id"))
		let fromCoords = getCoords(from.get("id"))
		let savedFrom = new Map(from)
		let savedTo = new Map(to)
		let enpassant = false
		let logsKeys = Array.from(logs.keys())
		let lastLogsArray = logs.get(logsKeys[logsKeys.length - 1])

		if (lastLogsArray && lastLogsArray.length != 0) {
			let lastLog = lastLogsArray[lastLogsArray.length - 1]

			if (lastLog.charAt(lastLog.length - 1) == y[fromCoords.get("y")] && from.get("piece").slice(1) == "pawn" && game[coords.get("y") + turns.get(from.get("piece").charAt(0))][coords.get("x")].get("piece") && game[coords.get("y") + turns.get(from.get("piece").charAt(0))][coords.get("x")].get("piece").slice(1) == "pawn" && x.indexOf(lastLog.charAt(0)) - x.indexOf(x[coords.get("x")]) == 0 && lastMoveForward) {
				setEnPassant(from, to)
				enpassant = true
			}
		}

		waitingForValidMove = new Map(game[coords.get("y")][coords.get("x")])
		game[coords.get("y")][coords.get("x")].set("piece", from.get("piece"))
		game[fromCoords.get("y")][fromCoords.get("x")].set("piece", false)

		pieces.splice(pieces.indexOf(pieces.find(e => e.get("id") == from.get("id"))), 1)
		pieces.push(projected)

		let inOffPieces = offPieces.find(p => p.get("id") == from.get("id"))
		if (inOffPieces && !inOffPieces.get("piece")) offPieces[offPieces.indexOf(inOffPieces)] = new Map(from)

		let checks = isCheck(projected, from)

		if (checks.length != 0 && checks.some(e => e.get("piece") == from.get("piece").charAt(0) + "king")) {
			return reject(false)
		} else {
			if (waitingForValidMove.get("piece")) eat(waitingForValidMove)

			if (from.get("piece").slice(1) == "pawn" && ((Math.floor(to.get("id") / game.length) == 0 && from.get("piece").charAt(0) == "w") || (Math.floor(to.get("id") / game.length) == 7 && from.get("piece").charAt(0) == "b"))) {
				setPromotion(projected).then(res => {
					if (mode != 2) setLogs(savedFrom, savedTo, false, res)
					game[fromCoords.get("y")][fromCoords.get("x")].set("piece", false)
					return resolve(res)
				}).catch(err => {
					console.log(err)
					game[fromCoords.get("y")][fromCoords.get("x")].set("piece", from.get("piece"))
					return reject(false)
				})
			} else {
				if (to.get("id") == from.get("id") + 16 * -turns.get(from.get("piece").charAt(0)) && from.get("piece").slice(1) == "pawn") {
					lastMoveForward = true
				} else lastMoveForward = false

				game[fromCoords.get("y")][fromCoords.get("x")].set("piece", false)

				for (let type in castling) {
					if (castling[type].some(e => e[0] == from.get("id"))) {
						let pos = castling[type].indexOf(castling[type].find(e => e[0] == from.get("id")))
						castling[type].splice(pos, 1)
					}
				}

				if (mode != 2) setLogs(from, to, false, false, enpassant)

				return resolve(enpassant)
			}
		}
	})
}

/**
 * Fonction génératerice de pièces et de leurs mouvements
 * @param {boolean|string=} color Ne générer que les pièces de la couleur
 * @param {boolean=} checkVerif Récupérer les mouvements pour vérifier un échec
 * @param {boolean|number=} onlyPiece Ne récupérer qu'une seule pièce
 */
function* getPiecesMovements(color = false, checkVerif = false, onlyPiece = false) {
	for (let piece of pieces.map(p => new Map(p))) {
		if ((color ? piece.get("piece").charAt(0) == color : true) && (onlyPiece ? piece.get("id") == onlyPiece : true)) {
			yield piece

			for (let move of getMoves(piece, false, checkVerif)) {
				let check = isCheck(new Map(piece).set("id", move), piece)

				if (!piece.get("piece")) continue

				if (!check.some(k => k.get("piece").charAt(0) == piece.get("piece").charAt(0))) {
					yield move
				}
			}
		}
	}
}

/**
 * Vérifier un état d'échec pour chaque roi
 * @param {object|boolean=} newMove Faux si pas de nouveau mouvement, sinon case incluant piece, id
 * @param {object|boolean=} from Faux si pas de nouveau mouvement, sinon case incluant piece, id
 * @returns {array} Tableau contenant le roi échec, 0 si pat, 1 si mat
 */
function isCheck(newMove = false, from = false) {
	let check = new Set()
	let by = new Array
	let context = pieces.map(p => new Map(p))

	if (newMove) {
		let coords = getCoords(newMove.get("id"))
		let fromCoords = getCoords(from.get("id"))

		if (game[coords.get("y")][coords.get("x")].get("piece")) pieces.splice(pieces.indexOf(pieces.find(e => e.get("id") == newMove.get("id"))), 1)
		pieces.splice(pieces.indexOf(pieces.find(e => e.get("id") == from.get("id"))), 1)
		pieces.push(newMove)

		game[fromCoords.get("y")][fromCoords.get("x")].set("piece", false)
		game[coords.get("y")][coords.get("x")].set("piece", newMove.get("piece"))
	}

	for (let piece of pieces) if (piece.get("piece")) {
		for (let e of getMoves(piece, false, true)) {
			let getPiece = pieces.find(p => p.get("id") == e)

			if (getPiece && getPiece.get("piece") == (piece.get("piece").charAt(0) == "w" ? "b" : "w") + "king") {
				check.add(getPiece)
				by.push(piece)
			}
		}
	}

	pieces = context.map(p => new Map(p))
	game = getPositionFromPieces(pieces)
	check = Array.from(check)

	if (!newMove) {
		if (Array.from(getPiecesMovements(Array.from(turns.keys()).find(k => turns.get(k) != turns.get("current")))).filter(value => typeof value == "number").length == 0) {
			if (check.length != 0) {
				return 1
			} else {
				return 0
			}
		}
	}

	return check
}

/**
 * Manger une pièce
 * @param {object} piece Case prise incluant piece, id
 */
function eat(piece) {
	pieces.splice(pieces.indexOf(pieces.find(e => e.get("id") == piece.get("id"))), 1)
	eaten.push(piece.get("piece"))
	addPoints(piece.get("piece"))

	let image = document.createElement("img")
	image.src = "../assets/chess/" + piece.get("piece") + ".png"
	image.width = "20"
	image.height = "20"

	document.getElementById(piece.get("piece").charAt(0) == "w" ? "black" : "white").appendChild(image)
}

/**
 * Ajouter les points au compteur
 * @param {string} piece Pièce mangée
 */
function addPoints(piece) {
	scores.set((piece.charAt(0) == "w" ? "b" : "w"), scores.get(piece.charAt(0) == "w" ? "b" : "w") + names.get(piece.slice(1))[2])
	updatePoints()
}

/**
 * Mettre à jour les points au compteur
 */
function updatePoints() {
	let diff = scores.get("w") - scores.get("b")

	if (diff > 0) {
		document.getElementById("whiteHeader").innerText = "Blanc (+" + diff + ")"
		document.getElementById("blackHeader").innerText = "Noir"
	} else if (diff < 0) {
		document.getElementById("whiteHeader").innerText = "Blanc"
		document.getElementById("blackHeader").innerText = "Noir (+" + Math.abs(diff) + ")"
	} else {
		document.getElementById("whiteHeader").innerText = "Blanc"
		document.getElementById("blackHeader").innerText = "Noir"
	}
}

// Good move : !
// Excellent move : !!
// Bad move : ?
// En passant : e.p.

/**
 * Récupère la notation d'un mouvement effectué
 * @param {object} from Case incluant piece, id
 * @param {object} to Case incluant piece, id
 * @param {boolean=} castle Roque effectué
 * @param {boolean|string=} promotion Pion à promotion
 * @param {boolean=} enpassant Prise en passant
 * @returns {string} Notation anglaise
 */
function log(from, to, castle = false, promotion = false, enpassant = false) {
	let res = new String()

	if (castle) {
		if (from.get("id") < to.get("id")) {
			return "O-O"
		} else {
			return "O-O-O"
		}
	} else {
		if (enpassant) {
			res += "e.p. "
			to.set("piece", (from.get("piece").charAt(0) == "w" ? "b" : "w") + "pawn")
		}

		res += names.get(from.get("piece").slice(1))[1]

		for (let piece of pieces) {
			if (piece.get("piece") == from.get("piece") && piece.get("id") != from.get("id")) {
				if (Array.from(getPiecesMovements(false, false, piece.get("id"))).filter(value => typeof value == "number").includes(to.get("id"))) res += x[from.get("id") % game.length]
				break
			}
		}

		if (to.get("piece")) {
			if (from.get("piece").slice(1) == "pawn") res += x[from.get("id") % game.length]
			res += "x"
		}

		res += x[to.get("id") % game.length] + y[Math.floor(to.get("id") / game.length)]

		if (promotion) res += "=" + names.get(promotion.slice(1))[1]

		let check = isCheck()

		if (typeof check == "number") {
			if (check == 0) {
				pat = true
				return res
			} else if (check == 1) {
				res += "#"
				mat = true
				return res
			}
		} else {
			if (check.length != 0) {
				res += "+"
			}
		}
	}

	return res
}

/**
 * Sauvegarder un mouvement
 * @param {object} from Case incluant piece, id
 * @param {object} to Case incluant piece, id
 * @param {boolean=} castle Roque effectué
 * @param {boolean|string=} promotion Pion à promotion
 * @param {boolean=} enpassant Prise en passant
 */
function setLogs(from, to, castle = false, promotion = false, enpassant = false) {
	if (!logs.get(turns.get("move"))) {
		logs.set(turns.get("move"), new Array)
	}

	let logged = log(from, to, castle, promotion, enpassant)
	let infos = document.getElementById("infos")

	logs.get(turns.get("move")).push(logged)

	let turn = document.getElementById(turns.get("move") + "_")

	if (!turn) {
		turn = document.createElement("tr")
		turn.id = turns.get("move") + "_"
		turn.className = "logrow"

		let moveUI = document.createElement("td")
		moveUI.innerText = turns.get("move") + "."

		infos.appendChild(turn)
		document.getElementById(turns.get("move") + "_").appendChild(moveUI)
	}

	let row = document.createElement("td")
	row.innerText = logged

	turn.appendChild(row)

	infos.scrollTop = infos.scrollHeight
}

/**
 * Purger les logs
 */
function clearLogs() {
	let table = document.getElementById("infos")
	document.querySelectorAll(".logrow").forEach(r => table.removeChild(r))
}

function clearMessages() {
	let messages = document.getElementById("messages")
	document.querySelectorAll(".message").forEach(m => messages.removeChild(m))
}

/*
Liste de choses à faire :
Y'aura le joueur vs bot
Y'aura un système pour progresser
Y'aura éventuellement un système de stats
Utiliser des class ? (pions, cases, moves, ...)
*/
