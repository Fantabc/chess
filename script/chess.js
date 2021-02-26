const db = firebase.database()

const movePath = 'url("../assets/chess/move.png")'
const moveColor = "#00b2ff"
const size = 100
const x = ["a", "b", "c", "d", "e", "f", "g", "h"]
const y = ["8", "7", "6", "5", "4", "3", "2", "1"]

let data
let mode = -1
let ended = false
let gameReady = false
let pseudo = "Hugo" // prompt("Choisissez un pseudo :").replace(/[^a-z0-9\ ]/gi, "")
let gameKey = new String()
let game = new Array()
let eaten = new Array()
let pieces = new Array()
let logs = new Object()
let selected = new Object()
let waitingForValidMove = new Object()
let scores = {
	"w": 0,
	"b": 0
}
let castling = {
	"qside": new Array(),
	"kside": new Array(),
	"kings": new Array()
}
let turns = {
    "w": 1,
    "b": -1,
    "current": 1,
    "move": 1
}
let names = {
    "pawn": ["pion", new String()],
    "knight": ["cavalier", "N"],
    "bishop": ["fou", "B"],
    "rook": ["tour", "R"],
    "queen": ["dame", "Q"],
    "king": ["roi", "K"]
}

while (!pseudo || pseudo == new String()) {
	pseudo = prompt("Vous devez choisir un pseudo valide :")
}

document.getElementById("player").innerText = pseudo

db.ref().on("value", snapshot => data = snapshot.val())

const waitForOpponent = () => db.ref("games").child(gameKey).child("players").on("value", snapshot => {
	let val = snapshot.val()

	if (!val) alert("Erreur")

	for (let key of Object.keys(val)) {
		if (key != pseudo) {
			document.getElementById("opponent").innerText = key
			break
		}
	}

	gameReady = true
})

const setListener = () => db.ref("games").child(gameKey).child("moves").on("value", snapshot => {
	console.log(snapshot.val())
	if (!snapshot.val()) return;
	let move = Object.values(snapshot.val())[Object.values(snapshot.val()).length - 1]
	getData(move["from"], move["to"], move["castle"], move["promotion"])
})

// Afin d'optimiser, essayer de réduire au maximum les boucles (par exemple, dans le check du setMove, on n'a besoin que des pièces de l'adversaire)

/**
 * Générer un pseudo
 * @param {number=} length Longueur du pseudo
 */
function getPseudo(length = Math.floor(Math.random() * 5 + 5)) {
	let all = new Array()
	for (let i = 0; i < 26; all.push(String.fromCharCode(65 + i++)));

	let res = all[Math.floor(Math.random() * all.length)]
	let letters = {
		"vowels": ["A", "E", "I", "O", "U", "Y"]
	}

	letters["consonants"] = all.filter(l => !letters["vowels"].includes(l))

	for (let i = 1; i < length; i++) {
		let next = letters[Object.keys(letters)[Object.keys(letters).indexOf(Object.keys(letters).find(key => letters[key].includes(res[i - 1]))) * -1 + 1]]
		let same = letters[Object.keys(letters).find(key => letters[key].includes(res[i - 1]))]

		for (let j = 0; j < same.length; Math.floor(Math.random() * 100) < 100 / same.length ? next.push(same[j++]) : j++);

		res += next[Math.floor(Math.random() * next.length)]
	}

	return res.charAt(0) + res.slice(1).toLowerCase()
}

/**
 * Connecter l'utilisateur à une partie
 * @param {number} type Type de la connexion (locale, IA, en ligne)
 */
function connect(type) {
	if (mode == -1) {
		if (type == 2 && data) {
			let keys = Object.keys(data["games"])

			if (keys.length != 0 || Object.keys(data.child(keys[keys.length - 1]).child("players")).length == 1) {
				gotoGame(keys[keys.length - 1])
				return
			}
		}

		startGame(type)
	} else alert("Une partie est déjà en cours !")
}

/**
 * Lancer une partie
 * @param {number} type 0 : partie locale | 1 : partie contre IA | 2 : partie en ligne
 */
function startGame(type) {
	mode = type
	ended = false

	switch (type) {
		case 0:
			init()
			document.getElementById("opponent").innerText = getPseudo()
			break

		case 1:
			document.getElementById("opponent").innerText = "Robot"
			break

		case 2:
			let color = Math.floor(Math.random() * Math.floor(100)) < 50 ? "white" : "black"
			let gameValue = new Object()
			let players = new Object()
			players[pseudo] = color
			gameValue["players"] = players

			let key = db.ref("games").push().key
			gameKey = key
			db.ref("games").child(key).update(gameValue)

			init(color)
			waitForOpponent()
			setListener()
			break
	}
}

/**
 * Initialiser le jeu avec une partie en attente
 * @param {string} id Clé de partie
 */
function gotoGame(id) {
	let game = data["games"][id]
	let color = game["players"][Object.keys(game["players"])[0]] == "white" ? "black" : "white"
	let currentData = new Object()
	currentData[pseudo] = color
	db.ref("games").child(id).child("players").update(currentData)

	document.getElementById("opponent").innerText = Object.keys(game["players"])[0]

	gameKey = id
	gameReady = true
	mode = 2
	init(color)
	setListener()
}

/**
 * Envoie les mouvements données à la base de données
 * @param {object} from Case incluant color, piece, id
 * @param {object} to Case incluant color, piece, id
 * @param {boolean} castle Roque effectué ?
 * @param {boolean|string} promotion Pion à promotion
 */
function sendData(from, to, castle, promotion) {
	db.ref("games").child(gameKey).child("moves").push().update({
		"from": from,
		"to": to,
		"castle": castle,
		"promotion": promotion
	})
}

/**
 *
 * @param {number} from Case incluant color, piece, id
 * @param {number} to Case incluant color, piece, id
 * @param {boolean} castle Roque effectué ?
 * @param {boolean|string} promotion Pion à promotion
 */
function getData(from, to, castle, promotion) {
	let fromCoords = getCoords(from["id"])
	let toCoords = getCoords(to["id"])

	if (castle && pieces.find(e => e["id"] == from["id"])) {
		setCastling(from, to)
	} else {
		// Si celui qui reçoit les données n'a plus de pièce from c'est qu'elle
		// a déjà été retirée par le setMove() donc inutile de tout refaire

		if (pieces.find(e => e["id"] == from["id"])) {
			let exist = Object.assign({}, pieces.find(e => e["id"] == to["id"]))
			let newPiece = {
				color: to["color"],
				piece: (promotion ? promotion : from["piece"]),
				id: to["id"]
			}

			console.log(newPiece)
			console.log(from, to, castle, promotion)

			if (exist["piece"]) pieces.splice(pieces.indexOf(pieces.find(e => e["id"] == to["id"])), 1)

			pieces.splice(pieces.indexOf(pieces.find(e => e["id"] == from["id"])), 1)
			console.log(newPiece)
			pieces.push(newPiece)

			game[toCoords["y"]][toCoords["x"]] = newPiece

			game[fromCoords["y"]][fromCoords["x"]] = {
				color: from["color"],
				piece: false,
				id: from["id"]
			}
		}
	}

	setLogs(from, to, castle, promotion)

	if (from["piece"].charAt(0) == "b") turns["move"]++

	selected = new Object()
	turns["current"] *= -1

	update()
}

let gens = new Array()

/**
 * Trouver un coup
 * @param {number} depth Niveau de recherche
 */
function findMove(depth) {
	if (depth > 25) throw new Error("Profondeur trop importante")

	let contextGame = game.map(r => [...r])
	let contextPieces = pieces.map(p => Object.assign({}, p))
	let contextTurn = turns["current"]
	let contextLast = new Array()
	let savedGame = game.map(r => [...r])
	let savedPieces = pieces.map(p => Object.assign({}, p))
	let positions = new Array()

	function localMove(from, to) {
		let fromCoords = getCoords(from["id"])
		let toCoords = getCoords(to["id"])
		let newPiece = {
			color: to["color"],
			piece: from["piece"],
			id: to["id"]
		}

		if (to["piece"]) contextPieces.splice(contextPieces.indexOf(contextPieces.find(e => e["id"] == to["id"])), 1)

		contextGame[fromCoords["y"]][fromCoords["x"]]["piece"] = false
		contextGame[toCoords["y"]][toCoords["x"]]["piece"] = from["piece"]

		contextPieces.splice(contextPieces.indexOf(contextPieces.find(e => e["id"] == from["id"])), 1)
		contextPieces.push(newPiece)

		contextLast[0] = {
			color: from["color"],
			piece: false,
			id: from["id"]
		}
		contextLast[1] = newPiece

		contextTurn *= -1
	}

	let gens = new Array()

	function* checkPiece() {
		for (let piece of contextPieces) {
			if (turns[piece["piece"].charAt(0)] == contextTurn) {
				yield piece
				yield* getMoves(piece, false, false)
			}
		}
	}

	function checkMove() {
		let iterator = checkPiece()
		let piece = new Object()

		gens.push(iterator)

		while (!iterator.done) {
			let value = iterator.next().value
			if (typeof value != "number") {
				piece = value
			} else {
				let coords = getCoords(value)

				localMove(piece, {
					color: contextGame[coords["y"]][coords["x"]]["color"],
					piece: contextGame[coords["y"]][coords["x"]]["piece"],
					id: value
				})

				if (gens.length == depth * 2) {
					positions.push(contextPieces.map(p => Object.assign({}, p)))
					let board = getPositionFromPieces(positions[positions.length - 1])
					game = board
					pieces = positions[positions.length - 1]
					update()
					alert("a")
					contextTurn *= -1
					return
				}

				checkMove()
			}
		}
	}

	checkMove()

	while (gens.length != 0) {
		let iterator = gens[gens.length - 1]
		let piece = new Object()

		for (;;) {
			let value = iterator.next().value

			if (!value) break

			console.log("============")

			localMove(contextLast[1], contextLast[0])
			console.log(contextLast[1], contextLast[0])

			if (typeof value != "number") {
				piece = value
			} else {
				let coords = getCoords(value)

				localMove(piece, {
					color: contextGame[coords["y"]][coords["x"]]["color"],
					piece: contextGame[coords["y"]][coords["x"]]["piece"],
					id: value
				})

				if (gens.length == depth * 2) {
					positions.push(contextPieces.map(p => Object.assign({}, p)))
					let board = getPositionFromPieces(positions[positions.length - 1])
					game = board
					pieces = positions[positions.length - 1]
					update()
					alert("a")
					contextTurn *= -1
				}
			}
		}

		gens.pop()
	}
}

/**
 * Initialiser le terrain
 * @param {string=} side Affichage côté noir ou blanc
 */
function init(side = "white") {
	let id = 0

	for (let i = 0; i < 8; i++) {
		game.push(new Array())

		for (let j = 0 + i % 2; j < 8 + i % 2; j++) {
			let pushed = {
				// color: (j % 2 == 0 ? "fafafa" : "564439"),
				color: (j % 2 == 0 ? "#fafafa" : "#614f45"),
				piece: false,
				id: id
			}

			switch (i % 8) {
				case 0:
					switch (j % 8) {
						case 0:
							pushed.piece = "brook"
							break

						case 1:
							pushed.piece = "bknight"
							break

						case 2:
							pushed.piece = "bbishop"
							break

						case 3:
							pushed.piece = "bqueen"
							break

						case 4:
							pushed.piece = "bking"
							break

						case 5:
							pushed.piece = "bbishop"
							break

						case 6:
							pushed.piece = "bknight"
							break

						case 7:
							pushed.piece = "brook"
							break
					}

					break

				case 1:
					pushed.piece = "bpawn"
					break

				case 6:
					pushed.piece = "wpawn"
					break

				case 7:
					switch ((j - 1) % 8) {
						case 0:
							pushed.piece = "wrook"
							break

						case 1:
							pushed.piece = "wknight"
							break

						case 2:
							pushed.piece = "wbishop"
							break

						case 3:
							pushed.piece = "wqueen"
							break

						case 4:
							pushed.piece = "wking"
							break

						case 5:
							pushed.piece = "wbishop"
							break

						case 6:
							pushed.piece = "wknight"
							break

						case 7:
							pushed.piece = "wrook"
							break
					}

					break
			}

			game[i].push(pushed)

			let cell = document.createElement("div")
			cell.id = pushed["id"]
			cell.className = "case " + (pushed["color"] == "#fafafa" ? "white" : "black")
			cell.ondrop = e => dropped(e)
			cell.ondragover = e => onDragOver(e)
			cell.ondragstart = e => onDragStart(e)
			cell.onclick = () => clicked(pushed["id"])

			if (pushed["piece"] && turns["current"] == turns[pushed["piece"].charAt(0)]) cell.draggable = "true"

			/*pushed["piece"]
				? cell.style.background = "url(\"../assets/chess/" + pushed["piece"] + ".png\"), " + pushed["color"] + ";"
				: cell.style.backgroundColor = pushed["color"]*/

			if (side == "black") cell.style.transform = "scaleY(-1) scaleX(-1)"

			document.getElementById("board").appendChild(cell)

			id++
		}

		document.getElementById("board").appendChild(document.createElement("br"))
	}

	for (let line of game) for (let p of line) if (p["piece"]) {
		let piece = p["piece"].slice(1)

		pieces.push(p)

		if (piece == "rook" || piece == "king") {
			if (line.indexOf(p) == 0) {
				castling["qside"].push([p["id"], p["piece"]])
			} else if (line.indexOf(p) == 7) {
				castling["kside"].push([p["id"], p["piece"]])
			} else castling["kings"].push([p["id"], p["piece"]])
		}
	}

	if (side == "black") {
		document.getElementById("board").style.transform = "scaleY(-1) scaleX(-1)"
	}

	for (let input of document.getElementsByClassName("idle")) input.style.display = "none"
	for (let input of document.getElementsByClassName("play")) input.style.display = "block"

	// Fonction à appeler lorsqu'on choisit un mode de jeu
	update()

	// findMove(2)
}

/**
 * Initialiser un terrain selon une position donnée
 * @param {array} all Répertoire de pièces
 * @returns {array} Terrain
 */
function getPositionFromPieces(all) {
	let board = new Array()

	for (let i = 0; i < 64; i++) {
		let y = Math.floor(i / 8)
		let already = all.find(p => i == p["id"])

		if (!board[y]) board[y] = new Array()

		if (already) {
			board[y].push(already)
		} else {
			board[y].push({
				color: i % 2 + y == 0 ? "#fafafa" : "#614f45",
				piece: false,
				id: i
			})
		}
	}

	return board
}

/**
 * Mettre à jour le terrain
 * @param {array=} context Terrain
 */
function update(context = game) {
	for (let y in context) {
		for (let x in context[y]) {
			document.getElementById(context[y][x].id.toString()).style.backgroundImage = (context[y][x].piece ? "url('../assets/chess/" + context[y][x].piece + ".png')" : null)

			if (context[y][x]["piece"] && turns["current"] == turns[context[y][x]["piece"].charAt(0)]) {
				if (mode == 0 || (mode == 2
					&& data["games"][gameKey]["players"][pseudo].charAt(0) == context[y][x]["piece"].charAt(0))) {
						document.getElementById(context[y][x]["id"]).draggable = true
					}
			} else {
				document.getElementById(context[y][x]["id"]).draggable = false
			}
		}
	}

	hideMoves()
	isCheck()
}

/**
 * Retire les doublons de pieces
 */
const cleanPieces = () => pieces = Array.from(new Set(pieces))

/**
 * Evenement lors d'un click sur une case
 * @param {number} id ID de la case cliquée
 * @param {boolean=} dropped Afficher l'animation du mouvement
 */
async function clicked(id, dropped = false) {
	let coords = getCoords(id)
	let cell = game[coords["y"]][coords["x"]]
	let previous = Object.assign({}, selected)
	let nextious = Object.assign({}, cell)

	console.log("Cliqué :", cell)

	if (ended || (mode == 2 && !gameReady)) return;

	if (cell["piece"]) {
		if ((mode == 2
			&& Object.keys(selected).length == 0
			&& data["games"][gameKey]["players"][pseudo].charAt(0) != cell["piece"].charAt(0))) return;
	}

	if (Object.keys(selected) != 0 && selected != cell && selected["piece"] && selected["piece"].slice(1) == "king" && cell["piece"] && castle(selected).includes(cell["id"])) {
		setCastling(selected, cell)

		if (mode == 2) {
			sendData(previous, nextious, true, false)
		} else {
			setLogs(previous, nextious, true)

			if (previous["piece"].charAt(0) == "b") turns["move"]++

			selected = new Object()
			turns["current"] *= -1

			update()
		}
	} else if (selected != cell && cell["piece"] != false && turns[cell["piece"].charAt(0)] == turns["current"]) {
		selected = cell
		hideMoves()
		showMoves(cell)
	} else if (Object.keys(selected).length != 0 && getMoves(selected).some(e => e == cell["id"])) {
		setMove(previous, nextious).then(res => {
			if (mode == 2) {
				sendData(previous, nextious, false, res)
			} else {
				if (previous["piece"].charAt(0) == "b") turns["move"]++

				selected = new Object()
				turns["current"] *= -1

				update()
			}
		}).catch(err => {
			console.log(err)
			// Remettre la case où on voulait bouger comme elle était avant
			let coords = getCoords(waitingForValidMove["id"])
			game[coords["y"]][coords["x"]]["piece"] = waitingForValidMove["piece"]
			waitingForValidMove = new Object()

			let selectedCoords = getCoords(selected["id"])
			game[selectedCoords["y"]][selectedCoords["x"]]["piece"] = previous["piece"]

			pieces.splice(pieces.indexOf(pieces.find(e => e["id"] == waitingForValidMove["id"])), 1)
			pieces.push(previous)
		})
	}
}

/**
 * Jouer un pion droppé
 * @param {object} event Evenement généré lorsqu'un pion est droppé
 */
function dropped(event) {
	event.preventDefault()
	clicked(event.target.id, true)
}

/**
 * Vérifier qu'un pion draggé passe sur une case valide
 * @param {object} event Evenement généré continuellement tant que l'utilisateur passe sur une case valide
 */
function onDragOver(event) {
	event.preventDefault()
}

/**
 * Imiter le pion draggé en pion cliqué
 * @param {object} event Evenement généré lorsqu'un pion est draggé
 */
function onDragStart(event) {
	let piece = pieces.find(e => e["id"] == event.target.id)

	selected = piece
	hideMoves()
	showMoves(selected)

	let image = new Image()
	image.src = "../assets/chess/" + piece["piece"] + ".png"
	event.dataTransfer.setDragImage(image, image.width / 2, image.height / 2)
}

/**
 * Affiche les mouvements disponibles pour une pièce
 * @param {object} cell Case contenant color, piece, id
 */
function showMoves(cell) {
	let res = getMoves(cell)

	for (let id of res) {
		let element = document.getElementById(id.toString())

		if (element.style.backgroundImage.trim() == "") {
			element.style.backgroundImage = movePath
		} else {
			let coords = getCoords(id)
			element.style.boxSizing = "border-box"

			if (game[coords["y"]][coords["x"]]["piece"].charAt(0) != cell["piece"].charAt(0)) {
				element.style.border = "5px solid " + moveColor
			} else {
				element.style.border = "5px solid #7cbf98"
			}
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
			let cell = game[coords["y"]][coords["x"]]

			element.style.backgroundImage = cell["piece"] ? "url('../assets/chess/" + cell["piece"] + ".png')" : null
		}

		element.style.border = "0"
	}
}

/**
 * Récuperer les coordonnées d'une case
 * @param {number} id ID de la case
 * @returns {object} Coordonnées Y et X du tableau game à l'ID voulu
 */
function getCoords(id) {
	return {
		y: Math.floor(id / game.length),
		x: id % game.length
	}
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

	if (coords["x"] >= 8 || coords["x"] < 0 || coords["y"] >= 8 || coords["y"] < 0) return null

	return game[coords["y"]][coords["x"]]
}

/**
 * Récupérer les mouvements disponibles pour une pièce dans un contexte
 * @param {object} cell Case incluant color, piece, id
 * @param {boolean=} castlingCheck Evite la recursivité entre castle(), isCheck() et getMoves()
 * @param {boolean=} context Rajouter aux pions les cases qu'ils menacent pour vérifier si le roi peut s'en approcher
 * @returns {array} Tableau contenant toutes les cases où peut aller la pièce demandée
 */
function getMoves(cell, castlingCheck = true, context = false) {
	let res = new Array()
	let contextGame = new Array()

	switch (cell["piece"].slice(1)) {
		case "pawn":
			// TODO: Utiliser la direction pour optimiser
			let direction = turns[cell["piece"].charAt(0)] * -1
			let row = Math.floor(cell["id"] / game.length)
			let pawnCells = [getCell(cell["id"], direction, 1), getCell(cell["id"], direction, -1)]
			let forwardCell = getCell(cell["id"], direction, 0)

			for (let ccell of pawnCells) if (ccell) {
				let coords = getCoords(ccell["id"])

				if (ccell && ccell["piece"]
					&& ccell["piece"].charAt(0) != cell["piece"].charAt(0)
					&& Math.abs(coords["y"] - row) == 1) res.push(ccell["id"])
			}

			if (forwardCell && !forwardCell["piece"]) res.push(forwardCell["id"])

			if ((row == 6 && cell["piece"].charAt(0) == "w") || (row == 1 && cell["piece"].charAt(0) == "b")) {
				let extraCell = getCell(cell["id"], direction * 2, 0)
				if (extraCell && !extraCell["piece"] && forwardCell && !forwardCell["piece"]) res.push(extraCell["id"])
			}

			if (context) {
				let leftCoords = getCoords(cell["id"] + 8 * direction - 1)
				let rightCoords = getCoords(cell["id"] + 8 * direction + 1)

				if (row - leftCoords["x"] == 1) res.push(cell["id"] + 8 * direction - 1)
				if (rightCoords["x"] - row == 1) res.push(cell["id"] + 8 * direction + 1)
			}

			break

		case "rook":
			res = lineMoves(cell)
			break

		case "knight":
			for (let i = -2; i < 3; i++) {
				for (let j = -2; j < 3; j++) {
					if (Math.abs(i) == Math.abs(j) || i == 0 || j == 0) continue

					let gcell = getCell(cell["id"], i, j)

					if (!gcell) continue

					let coords = getCoords(gcell["id"])
					let ccoords = getCoords(cell["id"])

					if ((!gcell["piece"] || gcell["piece"].charAt(0) != cell["piece"].charAt(0)) && (Math.abs(coords["x"] - ccoords["x"]) < 3) && (Math.abs(coords["y"] - ccoords["y"]) < 3)) {
						res.push(gcell["id"])
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
				getCell(cell["id"], 1, 1), getCell(cell["id"], 1, 0),
				getCell(cell["id"], 0, 1), getCell(cell["id"], -1, -1),
				getCell(cell["id"], -1, 0), getCell(cell["id"], 0, -1),
				getCell(cell["id"], -1, 1), getCell(cell["id"], 1, -1)
			]

			for (let gcell of cells) if (gcell && (!gcell["piece"] || gcell["piece"].charAt(0) != cell["piece"].charAt(0))) res.push(gcell["id"])

			if (castlingCheck && !isCheck().some(e => e["piece"] == cell["piece"].charAt(0) + "king")) res.push(...castle(cell))

			break

		default:
			break
	}

	return Array.from(new Set(res))
}

/**
 * Récupère les mouvements en ligne d'une pièce
 * @param {object} cell Case incluant color, piece, id
 * @returns {array} Tableau contenant les cases horizontalement et verticalement disponibles
 */
function lineMoves(cell) {
	// Fonctionnel bien que long
	let res = new Array()
	let add = [[true, true], [true, true]]
	//         y: -     +  | x: -     +
	let coords = getCoords(cell["id"])

	for (let i = 1; i < game.length; i++) {
		if (coords["y"] - i >= 0 && add[0][0]) {
			if (!game[coords["y"] - i][coords["x"]].piece) {
				res.push(game[coords["y"] - i][coords["x"]].id)
			} else if (game[coords["y"] - i][coords["x"]].piece.charAt(0) != cell.piece.charAt(0)) {
				res.push(game[coords["y"] - i][coords["x"]].id)
				add[0][0] = false
			} else {
				add[0][0] = false
			}
		} else add[0][0] = false

		if (coords["y"] + i <= 7 && add[0][1]) {
			if (!game[coords["y"] + i][coords["x"]].piece) {
				res.push(game[coords["y"] + i][coords["x"]].id)
			} else if (game[coords["y"] + i][coords["x"]].piece.charAt(0) != cell.piece.charAt(0)) {
				res.push(game[coords["y"] + i][coords["x"]].id)
				add[0][1] = false
			} else {
				add[0][1] = false
			}
		} else add[0][1] = false

		if (coords["x"] - i >= 0 && add[1][0]) {
			if (!game[coords["y"]][coords["x"] - i].piece) {
				res.push(game[coords["y"]][coords["x"] - i].id)
			} else if (game[coords["y"]][coords["x"] - i].piece.charAt(0) != cell.piece.charAt(0)) {
				res.push(game[coords["y"]][coords["x"] - i].id)
				add[1][0] = false
			} else {
				add[1][0] = false
			}
		} else add[1][0] = false

		if (coords["x"] + i <= 7 && add[1][1]) {
			if (!game[coords["y"]][coords["x"] + i].piece) {
				res.push(game[coords["y"]][coords["x"] + i].id)
			} else if (game[coords["y"]][coords["x"] + i].piece.charAt(0) != cell.piece.charAt(0)) {
				res.push(game[coords["y"]][coords["x"] + i].id)
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
 * @param {object} cell Case incluant color, piece, id
 * @returns {array} Tableau contenant les cases diagonalement disponibles
 */
function diagMoves(cell) {
	let res = new Array()
	let add = [true, true, true, true]
	let pieceCoords = getCoords(cell["id"])

	for (let i = 1; ; i++) {
		let ncells = [getCell(cell["id"], -i, -i), getCell(cell["id"], -i, i), getCell(cell["id"], i, -i), getCell(cell["id"], i, i)]
		let gcells = ncells.filter(e => e != null)

		if (add.some(element => element == true) && gcells.length != 0) {
			for (let ccell of gcells) {
				if (add[ncells.indexOf(ccell)]) {
					let ccoords = getCoords(ccell["id"])

					if (Math.abs(pieceCoords["x"] - ccoords["x"]) / Math.abs(pieceCoords["y"] - ccoords["y"]) == 1) {
						if (ccell["piece"]) {
							if (ccell["piece"].charAt(0) != cell["piece"].charAt(0)) res.push(ccell["id"])
							add[ncells.indexOf(ccell)] = false
						} else {
							res.push(ccell["id"])
						}
					}
				}
			}
		} else break
	}

	return res
}

// TODO: En passant
// Utiliser les logs des mouvements

/**
 * Récupérer les cases des roques disponibles
 * @param {object} cell Case incluant color, piece, id
 * @returns {array} Tableau contenant les cases des tours où le roque peut être joué
 */
function castle(cell) {
	let res = new Array()

	if (castling["kings"].some(e => e[0] == cell["id"])) {
		if (castling["qside"].some(e => e[1] == cell["piece"].charAt(0) + "rook")) {
			let qsidePossible = true

			for (let i = 1; i <= 2; i++) {
				let coords = getCoords(cell["id"] - i)

				if (game[coords["y"]][coords["x"]]["piece"]) {
					qsidePossible = false
					break
				}

				let check = isCheck({
					color: game[coords["y"]][coords["x"]]["color"],
					piece: cell["piece"],
					id: cell["id"] - i
				}, cell)

				if (check.some(e => e["piece"] == cell["piece"])) {
					qsidePossible = false
					break
				}
			}

			if (qsidePossible) res.push(castling["qside"].find(e => e[1] == cell["piece"].charAt(0) + "rook")[0])
		}

		if (castling["kside"].some(e => e[1] == cell["piece"].charAt(0) + "rook")) {
			let ksidePossible = true

			for (let i = 1; i <= 2; i++) {
				let coords = getCoords(cell["id"] + i)

				if (game[coords["y"]][coords["x"]]["piece"]) {
					ksidePossible = false
					break
				}

				let check = isCheck({
					color: game[coords["y"]][coords["x"]]["color"],
					piece: cell["piece"],
					id: cell["id"] + i
				}, cell)

				if (check.some(e => e["piece"] == cell["piece"])) {
					ksidePossible = false
					break
				}
			}

			if (ksidePossible) res.push(castling["kside"].find(e => e[1] == cell["piece"].charAt(0) + "rook")[0])
		}
	}

	return res
}

/**
 * Effectue un roque
 * @param {object} from Case incluant color, piece, id
 * @param {object} to Case incluant color, piece, id
 */
function setCastling(from, to) {
	let kingCoords = getCoords(from["id"])
	let rookCoords = getCoords(to["id"])
	let newKing = kingCoords["x"] + 2 * (Math.sign(from["id"] - to["id"]) * -1)
	let newRook = rookCoords["x"] + (from["id"] - to["id"] - Math.sign(from["id"] - to["id"]))

	game[kingCoords["y"]][newKing]["piece"] = from["piece"]
	game[kingCoords["y"]][kingCoords["x"]]["piece"] = false

	game[rookCoords["y"]][newRook]["piece"] = game[rookCoords["y"]][rookCoords["x"]]["piece"]
	game[rookCoords["y"]][rookCoords["x"]]["piece"] = false

	pieces.splice(pieces.indexOf(pieces.find(e => e["id"] == from["id"])), 1)
	pieces.splice(pieces.indexOf(pieces.find(e => e["id"] == to["id"])), 1)

	pieces.push(game[kingCoords["y"]][newKing])
	pieces.push(game[rookCoords["y"]][newRook])

	console.log(JSON.stringify(pieces, null, 4))
}

/**
 * Effectuer promotion
 * @param {object} cell Case incluant color, piece, id
 * @returns {promise} Promotion valide ou non
 */
function setPromotion(cell) {
	return new Promise((resolve, reject) => {
		let choices = ["cavalier", "fou", "tour", "dame"]
		let pro = prompt("Choisissez une pièce [" + choices.join("/") + "] :").toLowerCase()

		if (!choices.includes(pro)) {
			return reject(false)
		} else {
			let coords = getCoords(cell["id"])
			let newPiece = cell["piece"].charAt(0) + Object.keys(names).find(e => names[e][0] == pro)

			game[coords["y"]][coords["x"]]["piece"] = newPiece
			pieces[pieces.indexOf(pieces.find(e => e["id"] == cell["id"]))]["piece"] = newPiece

			return resolve(newPiece)
		}
	})
}

/**
 * Effectuer un enpassant
 * @param {object} from Case incluant color, piece, id
 * @param {object} to Case incluant color, piece, id
 */
function setEnPassant(from, to) {
	let direction = turns[from["piece"].charAt(0)] * -1
	let fromCoords = getCoords(from["id"])
	let toCoords = getCoords(to["id"])
	let cell = getCell(to["id"], direction * -1, 0)

	if (to["piece"]
		|| !cell["piece"]
		|| cell["piece"].slice(1) != "pawn"
		|| from["piece"].slice(1) != "pawn") return

	eat(game[toCoords["y"] + direction * -1][toCoords["x"]]["piece"])
	game[toCoords["y"] + direction * -1][toCoords["x"]]["piece"] = false

}

/**
 * Déplacer une pièce
 * @param {object} from Case d'origine incluant color, piece, id
 * @param {object} to Case d'arrivée incluant color, piece, id
 * @returns {promise} Mouvement valide ou non
 */
function setMove(from, to) {
	return new Promise((resolve, reject) => {
		let projected = {
			color: to["color"],
			piece: from["piece"],
			id: to["id"]
		}

		let coords = getCoords(projected["id"])
		let fromCoords = getCoords(from["id"])
		let savedFrom = Object.assign({}, from)
		let savedTo = Object.assign({}, to)

		waitingForValidMove = Object.assign({}, game[coords["y"]][coords["x"]])
		game[coords["y"]][coords["x"]]["piece"] = from["piece"]
		game[fromCoords["y"]][fromCoords["x"]]["piece"] = false

		pieces.splice(pieces.indexOf(pieces.find(e => e["id"] == from["id"])), 1)
		pieces.push(projected)

		let checks = isCheck(projected, from)

		if (checks.length != 0 && checks.some(e => e["piece"] == from["piece"].charAt(0) + "king")) {
			return reject(false)
		} else {
			if (waitingForValidMove["piece"]) eat(waitingForValidMove)

			if (from["piece"].slice(1) == "pawn" && ((Math.floor(to["id"] / game.length) == 0 && from["piece"].charAt(0) == "w") || (Math.floor(to["id"] / game.length == 7) && from["piece"].charAt(0) == "b"))) {
				setPromotion(projected).then(res => {
					if (mode != 2) setLogs(savedFrom, savedTo, false, res.slice(1))
					game[fromCoords["y"]][fromCoords["x"]]["piece"] = false
					return resolve(res)
				}).catch(err => {
					console.log(err)
					return reject(false)
				})
			} else {
				game[fromCoords["y"]][fromCoords["x"]]["piece"] = false

				for (let type in castling) {
					if (castling[type].some(e => e[0] == from["id"])) {
						let pos = castling[type].indexOf(castling[type].find(e => e[0] == from["id"]))
						castling[type].splice(pos, 1)
					}
				}

				if (mode != 2) setLogs(from, to)

				return resolve(false)
			}
		}
	})
}

/**
 * Vérifier un état d'échec pour chaque roi
 * @param {object|boolean=} newMove Faux si pas de nouveau mouvement, sinon case incluant color, piece, id
 * @param {object|boolean=} from Faux si pas de nouveau mouvement, sinon case incluant color, piece, id
 * @returns {array} Tableau contenant le roi échec, 0 si pat, 1 si mat
 */
function isCheck(newMove = false, from = false) {
	let check = new Set()
	let by = new Array()
	let context = [...pieces]

	if (newMove) {
		let coords = getCoords(newMove["id"])
		if (game[coords["y"]][coords["x"]]["piece"]) context.splice(context.indexOf(context.find(e => e["id"] == newMove["id"])), 1)
		context.push(newMove)
	}

	for (let piece of context) if (piece["piece"]) {
		for (let e of getMoves(piece, false, true)) {
			let getPiece = context.find(p => p["id"] == e)

			if (getPiece && getPiece["piece"] == (piece["piece"].charAt(0) == "w" ? "b" : "w") + "king") {
				check.add(getPiece)
				by.push(piece)
			}
		}
	}

	check = Array.from(check)

	if (!newMove) {
		let allMoves = {
			"w": new Array(),
			"b": new Array()
		}

		for (let piece of pieces) {
			allMoves[piece["piece"].charAt(0)].push(...getMoves(piece, false, true))
		}

		let color = Object.keys(turns).find(k => turns[k] == turns["current"])

		if (!check.some(e => e["piece"] == color + "king")) {
			let pat = true

			for (let piece of pieces) {
				let cellPiece = piece["piece"]
				if (piece["piece"].charAt(0) == color) {
					getMoves(piece, false, false).some(m => {
						let exist = Object.assign({}, pieces.find(e => e["id"] == m))
						let coords = getCoords(m)
						let fromCoords = getCoords(piece["id"])

						let projected = {
							color: game[coords["y"]][coords["x"]]["color"],
							piece: piece["piece"],
							id: m
						}

						// La case initiale de celle où on veut effectuer le mouvement
						toReplace = game[coords["y"]][coords["x"]]["piece"]

						// Editer la case de départ et d'arrivée
						game[coords["y"]][coords["x"]]["piece"] = piece["piece"]
						game[fromCoords["y"]][fromCoords["x"]]["piece"] = false

						if (Object.keys(exist).length != 0) {
							pieces[pieces.indexOf(pieces.find(e => e["id"] == exist["id"]))] = piece
						} else {
							pieces.splice(pieces.indexOf(pieces.find(e => e["id"] == piece["id"])), 1)
							pieces.push(projected)
						}

						let checkSave = isCheck(projected, piece)

						// Remettre les cases à leur état initial
						game[coords["y"]][coords["x"]]["piece"] = toReplace
						game[fromCoords["y"]][fromCoords["x"]]["piece"] = cellPiece

						if (Object.keys(exist).length != 0) {
							pieces.push(exist)
						} else {
							pieces.splice(pieces.indexOf(pieces.find(e => e["id"] == m)), 1)
							pieces.push(piece)
						}

						cleanPieces()

						if (!checkSave.some(e => e["piece"] == color + "king")) {
							pat = false
							return true
						}
					})

					if (!pat) break
				}
			}

			if (pat) {
				alert("Pat")
				ended = true
				return 0
			}
		} else if (check.length != 0 && check.some(e => e["piece"] == color + "king")) {
			let mat = true

			for (let piece of pieces) {
				let cellPiece = piece["piece"]
				if (piece["piece"].charAt(0) == color) {
					getMoves(piece, false, false).some(m => {
						let exist = Object.assign({}, pieces.find(e => e["id"] == m))
						let coords = getCoords(m)
						let fromCoords = getCoords(piece["id"])

						let projected = {
							color: game[coords["y"]][coords["x"]]["color"],
							piece: piece["piece"],
							id: m
						}

						// La case initiale de celle où on veut effectuer le mouvement
						toReplace = game[coords["y"]][coords["x"]]["piece"]

						// Editer la case de départ et d'arrivée
						game[coords["y"]][coords["x"]]["piece"] = piece["piece"]
						game[fromCoords["y"]][fromCoords["x"]]["piece"] = false

						if (Object.keys(exist).length != 0) {
							pieces[pieces.indexOf(pieces.find(e => e["id"] == m))] = projected
						} else {
							pieces.splice(pieces.indexOf(pieces.find(e => e["id"] == piece["id"])), 1)
							pieces.push(projected)
						}

						let checkSave = isCheck(projected, piece)

						// Remettre les cases à leur état initial
						game[coords["y"]][coords["x"]]["piece"] = toReplace
						game[fromCoords["y"]][fromCoords["x"]]["piece"] = cellPiece

						if (Object.keys(exist).length != 0) {
							pieces[pieces.indexOf(pieces.find(e => e["id"] == m))] = exist
						} else {
							pieces.splice(pieces.indexOf(pieces.find(e => e["id"] == m)), 1)
							pieces.push(piece)
						}

						cleanPieces()

						if (!checkSave.some(e => e["piece"] == color + "king")) {
							mat = false
							return true
						}
					})

					if (!mat) break
				}
			}

			if (mat) {
				alert("Mat")
				ended = true
				return 1
			}
		}
	}

	return check
}

/**
 * Manger une pièce
 * @param {object} piece Case prise incluant color, piece, id
 */
function eat(piece) {
	pieces.splice(pieces.indexOf(pieces.find(e => e["id"] == piece["id"])), 1)
	eaten.push(piece["piece"])
	addPoints(piece["piece"])

	let image = document.createElement("img")
	image.src = "../assets/chess/" + piece["piece"] + ".png"
	image.width = "20"
	image.height = "20"

	document.getElementById(piece["piece"].charAt(0) == "w" ? "black" : "white").appendChild(image)
}

/**
 * Ajouter les points au compteur
 * @param {string} piece Pièce mangée
 */
function addPoints(piece) {
	let points = {
		"pawn": 1,
		"rook": 5,
		"knight": 3,
		"bishop": 3,
		"queen": 9
	}

	scores[piece.charAt(0) == "w" ? "b" : "w"] += points[piece.slice(1)]

	updatePoints()
}

/**
 * Mettre à jour les points au compteur
 */
function updatePoints() {
	let diff = scores["w"] - scores["b"]

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
 * @param {object} from Case incluant color, piece, id
 * @param {object} to Case incluant color, piece, id
 * @param {boolean=} castle Roque effectué
 * @param {boolean|string=} promotion Pion à promotion
 * @returns {string} Notation anglaise
 */
function log(from, to, castle = false, promotion = false) {
	let res = new String()

	if (castle) {
		if (from["id"] < to["id"]) {
			return "O-O"
		} else {
			return "O-O-O"
		}
	} else {
		res += names[from["piece"].slice(1)][1]

		for (let piece of pieces) {
			if (piece["piece"] == from["piece"] && piece["id"] != from["id"]) {
				let coords = getCoords(to["id"])

				let moves = getMoves(piece, false, false)

				game[coords["y"]][coords["x"]]["piece"] = piece["piece"]

				if (moves.includes(to["id"])) res += x[from["id"] % game.length]
				break
			}
		}

		if (to["piece"]) {
			if (from["piece"].slice(1) == "pawn") res += x[from["id"] % game.length]
			res += "x"
		}

		res += x[to["id"] % game.length] + y[Math.floor(to["id"] / game.length)]

		if (promotion) res += "=" + names[promotion.slice(1)][1]

		let check = isCheck()

		if (typeof check == "number" && check == 1) {
			res += "#"
		} else if (check.length != 0) {
			res += "+"
		}
	}

	return res
}

/**
 * Sauvegarder un mouvement
 * @param {object} from Case incluant color, piece, id
 * @param {object} to Case incluant color, piece, id
 * @param {boolean=} castle Roque effectué
 * @param {boolean|string=} promotion Pion à promotion
 */
function setLogs(from, to, castle = false, promotion = false) {
	if (!logs[turns["move"]]) {
		logs[turns["move"]] = new Array()
	}

	let logged = log(from, to, castle, promotion)
	let infos = document.getElementById("infos")

	logs[turns["move"]].push(logged)

	let turn = document.getElementById(turns["move"] + "_")

	if (!turn) {
		turn = document.createElement("tr")
		turn.id = turns["move"] + "_"

		let moveUI = document.createElement("td")
		moveUI.innerText = turns["move"] + "."

		infos.appendChild(turn)
		document.getElementById(turns["move"] + "_").appendChild(moveUI)
	}

	let row = document.createElement("td")
	row.innerText = logged

	turn.appendChild(row)

	infos.scrollTop = infos.scrollHeight
}

/*
Liste de choses à faire :
Y'aura le joueur vs AI
Y'aura un système pour progresser
Y'aura éventuellement un système de stats
fermer ma gueule et doublé le code car le nv est insuffisant (t'es une merde !)2/40 coeff 20 peux mieu faire
Utiliser des class ? (pions, cases, moves, ...)
*/
