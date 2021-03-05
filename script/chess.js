const db = firebase.database()

const movePath = 'url("../assets/chess/move.png")'
const moveColor = "#00b2ff"
const size = 100
const x = ["a", "b", "c", "d", "e", "f", "g", "h"]
const y = ["8", "7", "6", "5", "4", "3", "2", "1"]
const offPieces = new Array()

let data = null
let mode = -1
let pat = false
let mat = false
let ended = false
let gameReady = false
let lastMoveForward = false
let pseudo = new String()
let gameKey = new String()
let game = new Array()
let eaten = new Array()
let pieces = new Array()
let lastCheck = new Array()
let logs = new Object()
let selected = new Object()
let players = new Object()
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
    "current": -1,
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

document.body.className = new String()

while (!pseudo || pseudo.length == 0 || pseudo == "Robot") {
	pseudo = prompt("Vous devez choisir un pseudo valide :")
}

document.getElementById("player").innerText = pseudo

db.ref().on("value", snapshot => data = snapshot.val())

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
 * Activer l'écouteur des adversaires
 */
function receiveOpponent() {
	db.ref("games").child(gameKey).child("players").on("value", snapshot => {
		let val = snapshot.val()

		if (!val) alert("Erreur")

		for (let key of Object.keys(val)) {
			if (key != pseudo) {
				document.getElementById("opponent").innerText = key
				players[key] = players["w"] ? "b" : "w"
				break
			}
		}

		gameReady = true
	})
}

/**
 * Activer l'écouteur des mouvements
 */
function receiveMoves() {
	db.ref("games").child(gameKey).child("moves").on("value", snapshot => {
		if (!snapshot.val()) return;
		let move = Object.values(snapshot.val())[Object.values(snapshot.val()).length - 1]
		getData(move["from"], move["to"], move["castle"], move["promotion"], move["enpassant"])
	})
}

/**
 * Activer l'écouteur des actions
 */
function receiveActions() {
	db.ref("games").child(gameKey).child("actions").on("value", snapshot => {
		console.log(snapshot.val())
		if (!snapshot.val()) return;
		let action = Object.values(snapshot.val())[Object.values(snapshot.val()).length - 1]

	})
}

// Afin d'optimiser, essayer de réduire au maximum les boucles (par exemple, dans le check du setMove, on n'a besoin que des pièces de l'adversaire)

/**
 * Générer un pseudo
 * @param {number=} length Longueur du pseudo
 * @returns {string} Pseudo généré de façon aléatoire dans tous les sens du terme
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

	res = res.charAt(0) + res.slice(1).toLowerCase()

	if (res == pseudo) res = getPseudo()

	return res
}

/**
 * Réinitialiser toutes les variables
 */
function resetAll() {
	game = getPositionFromPieces(offPieces)
	pieces = offPieces.map(p => Object.assign({}, p))

	data = null
	mode = -1
	pat = false
	mat = false
	ended = false
	gameReady = false
	lastMoveForward = false
	gameKey = new String()
	game = new Array()
	eaten = new Array()
	pieces = new Array()
	lastCheck = new Array()
	logs = new Object()
	selected = new Object()
	players = new Object()
	waitingForValidMove = new Object()
	turns["current"] = 1

	scores = {
		"w": 0,
		"b": 0
	}

	castling = {
		"qside": new Array(),
		"kside": new Array(),
		"kings": new Array()
	}
}

/**
 * Connecter l'utilisateur à une partie
 * @param {number} type Type de la connexion (locale, IA, en ligne)
 */
function connect(type) {
	if (mode == -1) {
		clearLogs()

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

	let color = Math.floor(Math.random() * Math.floor(100)) < 50 ? "white" : "black"

	switch (type) {
		case 0:
			update("white", true)

			let opponent = getPseudo()
			document.getElementById("opponent").innerText = opponent

			players[opponent] = "b"
			players[pseudo] = "w"
			break

		case 1:
			document.getElementById("opponent").innerText = "Robot"
			document.getElementById("nobot").style.display = "none"

			update(color, true)

			players[pseudo] = color
			players["Robot"] = color == "w" ? "b" : "w"

			if (color == "black") console.log(findMove(2))
			break

		case 2:
			let gameValue = new Object()

			players[pseudo] = color
			gameValue["players"] = players

			let key = db.ref("games").push().key
			gameKey = key
			db.ref("games").child(key).update(gameValue)

			update(color, true)
			receiveOpponent()
			receiveMoves()
			break
	}
}

/**
 * Terminer une partie
 * @param {number} result Type de fin de partie (nul, mat, abandon)
 */
function stopGame(result) {
	if (result == 1 || result == 2) {
		let winner = Object.keys(players).find(player => turns["current"] != turns[players[player]])
		alert(winner + " a gagné par " + (result == 1 ? "mat" : "abandon") + " !")
	} else if (result == 0) {
		alert("Egalité !")
	} else throw new Error("Résultat indeterminable : " + result)

	for (let input of document.getElementById("types").childNodes) {
		if (!input.style) continue
		if (input.className == "idle") {
			input.style.display = "block"
		} else {
			input.style.display = "none"
		}
	}

	resetAll()
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
	update(color, true)
	receiveMoves()
}

/**
 * Envoie les mouvements données à la base de données
 * @param {object} from Case incluant color, piece, id
 * @param {object} to Case incluant color, piece, id
 * @param {boolean} castle Roque effectué ?
 * @param {boolean|string} promotion Pion à promotion
 * @param {boolean} enpassant Prise en passant
 */
function sendData(from, to, castle, promotion, enpassant) {
	db.ref("games").child(gameKey).child("moves").push().update({
		"from": from,
		"to": to,
		"castle": castle,
		"promotion": promotion,
		"enpassant": enpassant
	})
}

/**
 *
 * @param {number} from Case incluant color, piece, id
 * @param {number} to Case incluant color, piece, id
 * @param {boolean} castle Roque effectué ?
 * @param {boolean|string} promotion Pion à promotion
 * @param {boolean} enpassant Prise en passant
 */
function getData(from, to, castle, promotion, enpassant) {
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

			if (exist["piece"]) pieces.splice(pieces.indexOf(pieces.find(e => e["id"] == to["id"])), 1)

			pieces.splice(pieces.indexOf(pieces.find(e => e["id"] == from["id"])), 1)
			pieces.push(newPiece)

			if (to["id"] == from["id"] + 16 * -turns[from["piece"].charAt(0)] && from["piece"].slice(1) == "pawn") {
				lastMoveForward = true
			} else lastMoveForward = false

			if (enpassant) setEnPassant(from, to)

			game[toCoords["y"]][toCoords["x"]] = newPiece
			game[fromCoords["y"]][fromCoords["x"]] = {
				color: from["color"],
				piece: false,
				id: from["id"]
			}
		}
	}

	setLogs(from, to, castle, promotion, enpassant)

	if (from["piece"].charAt(0) == "b") turns["move"]++

	selected = new Object()
	update()
}

/**
 * Demander la nulle
 */
function askDraw() {
	if (mode == 0) {
		if (confirm((turns["current"] == 1
			? pseudo
			: document.getElementById("opponent").innerText) + " demande la nulle. Accepter ?")) {
			stopGame(0)
		} else {
			alert("Nulle refusée")
		}
	}
}

/**
 * Abandonner
 */
const resign = () => stopGame(2)

/**
 * Trouver un coup
 * @param {number} depth Niveau de recherche
 */
function findMove(depth) {
	if (depth > 10) throw new Error("Profondeur trop importante")

	let gens = new Array()
	let gensPieces = new Array()
	let contextGame = game.map(r => [...r])
	let contextPieces = pieces.map(p => Object.assign({}, p))
	let contextTurn = turns["current"]
	let positions = new Array()
	let saved = new Array()
	let orderedPieces = new Array()

	function localMove(from, to) {
		console.log(from, to)
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

		update(getPositionFromPieces(contextPieces), false)
		alert("a")
	}

	function* checkPiece() {
		for (let piece of contextPieces) {
			if (turns[piece["piece"].charAt(0)] == contextTurn) {
				yield piece
				yield* getMoves(piece, false, false)
			}
		}
	}

	console.log("### Initialisation ###")

	// Initialiser les générateurs
	for (let i = 0; i < depth * 2; i++) {
		let iterator = checkPiece()
		let piece = new Object()

		gens.push(iterator)
		positions.push(contextPieces.map(p => Object.assign({}, p)))

		while (typeof move != "number") {
			let value = iterator.next().value

			if (!value) continue

			if (typeof value == "object") {
				piece = Object.assign({}, value)
				orderedPieces.push(piece)
			} else {
				let coords = getCoords(value)

				localMove(piece, {
					color: contextGame[coords["y"]][coords["y"]]["color"],
					piece: contextGame[coords["y"]][coords["x"]]["piece"],
					id: value
				})

				if (i != depth * 2 - 1) contextTurn *= -1
				break
			}
		}
	}

	console.log("### while gens ###")

	while (gens.length != 0) {
		let iterator = gens[gens.length - 1]
		let piece = new Object()

		console.log("### Début de générateur ### ")

		for (;;) {
			let value = iterator.next().value

			if (!value || (typeof value != "object" && Object.keys(piece).length == 0)) {
				gens.pop()
				positions.pop()
				contextTurn *= -1
				break
			} else {
				if (typeof value == "object") {
					piece = Object.assign({}, value)
				} else {
					let coords = getCoords(value)

					localMove(piece, {
						color: contextGame[coords["y"]][coords["x"]]["color"],
						piece: contextGame[coords["y"]][coords["x"]]["piece"],
						id: value
					})

					saved.push(contextPieces.map(p => Object.assign({}, p)))

					contextPieces = positions[positions.length - 1].map(p => Object.assign({}, p))
					contextGame = getPositionFromPieces(contextPieces)
				}
			}
		}

		console.log("### Fin de générateur ###")

		if (gens.length == 0) {
			break
		} else {
			iterator = gens[gens.length - 1]

			for (;;) {
				let value = iterator.next().value

				if (!value) {
					break
				} else {
					if (typeof value == "number") {
						if (Object.keys(piece).length == 0) piece = orderedPieces.pop()

						let coords = getCoords(value)

						localMove(piece, {
							color: contextGame[coords["y"]][coords["y"]]["color"],
							piece: contextGame[coords["y"]][coords["x"]]["piece"],
							id: value
						})

						let current = contextPieces.map(p => Object.assign({}, p))
						saved.push(current)
						positions[positions.length - 1] = current

						contextTurn *= -1
						gens.push(checkPiece())
						break
					} else {
						piece = Object.assign({}, value)
					}
				}
			}
		}

		console.log(saved)
	}

	update(getPositionFromPieces(contextPieces), false)
}

/**
 * Initialiser le terrain
 */
function init() {
	let id = 0

	for (let i = 0; i < 8; i++) {
		game.push(new Array())

		for (let j = 0 + i % 2; j < 8 + i % 2; j++) {
			let pushed = {
				color: (j % 2 == 0 ? "#fafafa" : "#755d4f"),
				// color: (j % 2 == 0 ? "#fafafa" : "#564439")
				// color: (j % 2 == 0 ? "#fafafa" : "#614f45"),
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
			cell.className = "case " + (pushed["color"] == "#fafafa" ? "white" : "classic")
			cell.ondrop = e => onDrop(e)
			cell.ondragover = e => onDragOver(e)
			cell.ondragstart = e => onDragStart(e)
			cell.onclick = () => onClicked(pushed["id"])
			cell.draggable = false

			document.getElementById("board").appendChild(cell)

			id++
		}

		document.getElementById("board").appendChild(document.createElement("br"))
	}

	for (let line of game) for (let p of line) if (p["piece"]) {
		let piece = p["piece"].slice(1)

		offPieces.push(Object.assign({}, p))

		if (piece == "rook" || piece == "king") {
			if (line.indexOf(p) == 0) {
				castling["qside"].push([p["id"], p["piece"]])
			} else if (line.indexOf(p) == 7) {
				castling["kside"].push([p["id"], p["piece"]])
			} else castling["kings"].push([p["id"], p["piece"]])
		}
	}

	pieces = offPieces.map(p => Object.assign({}, p))

	update()
}

init()

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
 * @param {string=} side Définir un sens à mettre à jour
 * @param {boolean=} init Initialiser un terrain ou non
 */
function update(side = "white", init = false) {
	if (!init) {
		turns["current"] *= -1
	} else {
		for (let input of document.getElementsByClassName("idle")) input.style.display = "none"
		for (let input of document.getElementsByClassName("play")) input.style.display = "block"
	}

	for (let y in game) {
		for (let x in game[y]) {
			document.getElementById(game[y][x]["id"].toString()).style.backgroundImage = (game[y][x]["piece"] ? "url('../assets/chess/" + game[y][x]["piece"] + ".png')" : null)

			if (game[y][x]["piece"] && turns["current"] == turns[game[y][x]["piece"].charAt(0)]) {
				if (mode == 0 || (mode == 2
					&& data["games"][gameKey]["players"][pseudo].charAt(0) == game[y][x]["piece"].charAt(0))) {
						document.getElementById(game[y][x]["id"]).draggable = true
					}
			} else {
				document.getElementById(game[y][x]["id"]).draggable = false
			}

			if (side == "black" || side == "b") document.getElementById(game[y][x]["id"]).style.transform = "scaleY(-1) scaleX(-1)"
		}
	}

	hideMoves()

	if (!init) {
		if (pat) {
			stopGame(0)
		} else if (mat) {
			stopGame(1)
		}
	}

	if (side == "black" || side == "b") document.getElementById("board").style.transform = "scaleY(-1) scaleX(-1)"
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
function onClicked(id, dropped = false) {
	let coords = getCoords(id)
	let cell = game[coords["y"]][coords["x"]]

	if (mode == -1 || ended || (mode == 2 && !gameReady)) return;

	if (cell["piece"]) {
		if ((mode == 2
			&& Object.keys(selected).length == 0
			&& data["games"][gameKey]["players"][pseudo].charAt(0) != cell["piece"].charAt(0))) return;
	}

	let previous = Object.assign({}, selected)
	let nextious = Object.assign({}, cell)

	if (Object.keys(selected) != 0 && selected != cell && selected["piece"] && selected["piece"].slice(1) == "king" && cell["piece"] && castle(selected).includes(cell["id"])) {
		setCastling(selected, cell)

		if (mode == 2) {
			sendData(previous, nextious, true, false, false)
		} else {
			setLogs(previous, nextious, true)

			if (previous["piece"].charAt(0) == "b") turns["move"]++

			selected = new Object()

			update()
		}
	} else if (selected["id"] != cell["id"] && cell["piece"] != false && turns[cell["piece"].charAt(0)] == turns["current"] && !dropped) {
		selected = Object.assign({}, cell)
		hideMoves()
		showMoves(cell)
	} else if (Object.keys(selected).length != 0 && getMoves(selected).some(e => e == cell["id"])) {
		setMove(previous, nextious).then(res => {
			if (mode == 2) {
				sendData(previous, nextious, false, (typeof res == "string" ? res : false), (typeof res == "boolean" ? res : false))
			} else {
				if (previous["piece"].charAt(0) == "b") turns["move"]++

				selected = new Object()

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

			document.getElementById(selected["id"]).style.backgroundImage = "url('../assets/chess/" + selected["piece"] + ".png')"
		})
	} else {
		document.getElementById(selected["id"]).style.backgroundImage = "url('../assets/chess/" + selected["piece"] + ".png')"
	}
}

/**
 * Jouer un pion droppé
 * @param {object} event Evenement généré lorsqu'un pion est droppé
 */
function onDrop(event) {
	event.preventDefault()

	if (event.target.id == selected["id"]) {
		document.getElementById(selected["id"]).style.backgroundImage = "url('../assets/chess/" + selected["piece"] + ".png')"
	} else onClicked(event.target.id, true)
}

/**
 * Vérifier qu'un pion draggé passe sur une case valide
 * @param {object} event Evenement généré continuellement tant que l'utilisateur passe sur une case valide
 */
function onDragOver(event) {
	event.preventDefault()
	event.dataTransfer.dropEffect = "move"
}

/**
 * Imiter le pion draggé en pion cliqué
 * @param {object} event Evenement généré lorsqu'un pion est draggé
 */
function onDragStart(event) {
	if (mode == -1) return false;
	let piece = pieces.find(e => e["id"] == event.target.id)

	selected = piece
	hideMoves()
	showMoves(selected)

	document.getElementById(selected["id"]).style.backgroundImage = "none"

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
			let coords = getCoords(cell["id"])
			let lastLogsArray = logs[Object.keys(logs)[Object.keys(logs).length - 1]]

			for (let ccell of pawnCells) if (ccell) {
				let ccords = getCoords(ccell["id"])
				if (ccell["piece"] && ccell["piece"].charAt(0) != cell["piece"].charAt(0) && Math.abs(ccords["x"] - coords["x"]) == 1 && Math.abs(ccords["y"] - coords["y"]) == 1) res.push(ccell["id"])
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

			if (lastLogsArray && lastLogsArray.length != 0) {
				let lastLog = lastLogsArray[lastLogsArray.length - 1]

				if (lastLog.charAt(1) == y[coords["y"]] && Math.abs(x.indexOf(lastLog.charAt(0)) - x.indexOf(x[coords["x"]])) == 1 && lastLog.length == 2 && lastMoveForward) {
					let enpassant = game[coords["y"] + turns[cell["piece"].charAt(0)] * -1][x.indexOf(lastLog.charAt(0))]
					let epcoords = getCoords(enpassant["id"])

					if (Math.abs(coords["x"] - epcoords["x"]) == 1) {
						res.push(enpassant["id"])
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

			for (let gcell of cells) {
				if (gcell && (!gcell["piece"] || gcell["piece"].charAt(0) != cell["piece"].charAt(0))) {
					let coords = getCoords(cell["id"])
					let gCoords = getCoords(gcell["id"])

					if (Math.abs(coords["y"] - gCoords["y"]) <= 1 && Math.abs(coords["x"] - gCoords["x"]) <= 1) {
						res.push(gcell["id"])
					}
				}
			}

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

/**
 * Retire les mouvements illégaux
 * @param {object} cell Case contenant color, piece, id
 */
function removeMoves(cell, moves) {
	for (let move of moves) {
		// Ignorer
	}
}

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

			pieces.splice(pieces.indexOf(pieces.find(e => e["id"] == cell["id"])))
			pieces.push({
				color: cell["color"],
				piece: newPiece,
				id: cell["id"]
			})

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
	let ptd = Object.assign({}, pieces.find(p => p["id"] == getCell(to["id"], turns[from["piece"].charAt(0)], 0)["id"]))
	let coords = getCoords(ptd["id"])
	game[coords["y"]][coords["x"]]["piece"] = false
	eat(ptd)
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
		let enpassant = false
		let lastLogsArray = logs[Object.keys(logs)[Object.keys(logs).length - 1]]

		if (lastLogsArray && lastLogsArray.length != 0) {
			let lastLog = lastLogsArray[lastLogsArray.length - 1]

			if (lastLog.charAt(lastLog.length - 1) == y[fromCoords["y"]] && from["piece"].slice(1) == "pawn" && game[coords["y"] + turns[from["piece"].charAt(0)]][coords["x"]]["piece"].slice(1) == "pawn" && x.indexOf(lastLog.charAt(0)) - x.indexOf(x[coords["x"]]) == 0) {
				setEnPassant(from, to)
				enpassant = true
			}
		}

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

			if (from["piece"].slice(1) == "pawn" && ((Math.floor(to["id"] / game.length) == 0 && from["piece"].charAt(0) == "w") || (Math.floor(to["id"] / game.length) == 7 && from["piece"].charAt(0) == "b"))) {
				setPromotion(projected).then(res => {
					if (mode != 2) setLogs(savedFrom, savedTo, false, res.slice(1))
					game[fromCoords["y"]][fromCoords["x"]]["piece"] = false
					return resolve(res)
				}).catch(err => {
					console.log(err)
					return reject(false)
				})
			} else {
				if (to["id"] == from["id"] + 16 * -turns[from["piece"].charAt(0)] && from["piece"].slice(1) == "pawn") {
					lastMoveForward = true
				} else lastMoveForward = false

				game[fromCoords["y"]][fromCoords["x"]]["piece"] = false

				for (let type in castling) {
					if (castling[type].some(e => e[0] == from["id"])) {
						let pos = castling[type].indexOf(castling[type].find(e => e[0] == from["id"]))
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
 */
function* getPiecesMovements(color = false) {
	for (let piece of pieces) {
		if (color ? piece["piece"].charAt(0) == color : true) {
			yield piece
			yield* getMoves(piece, null, true)
		}
	}
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
	let context = pieces.map(p => Object.assign({}, p))

	if (newMove) {
		let coords = getCoords(newMove["id"])
		let fromCoords = getCoords(from["id"])

		if (game[coords["y"]][coords["x"]]["piece"]) pieces.splice(pieces.indexOf(pieces.find(e => e["id"] == newMove["id"])), 1)
		pieces.push(newMove)

		game[fromCoords["y"]][fromCoords["x"]]["piece"] = false
		game[coords["y"]][coords["x"]]["piece"] = newMove["piece"]
	}

	for (let piece of pieces) if (piece["piece"]) {
		for (let e of getMoves(piece, false, true)) {
			let getPiece = pieces.find(p => p["id"] == e)

			if (getPiece && getPiece["piece"] == (piece["piece"].charAt(0) == "w" ? "b" : "w") + "king") {
				check.add(getPiece)
				by.push(piece)
			}
		}
	}

	pieces = context.map(p => Object.assign({}, p))
	game = getPositionFromPieces(pieces)
	check = Array.from(check)

	if (!newMove) {
		let allMoves = {
			"w": new Array(),
			"b": new Array()
		}

		for (let piece of pieces) allMoves[piece["piece"].charAt(0)].push(...getMoves(piece, false, true))

		let color = Object.keys(turns).find(k => turns[k] != turns["current"])
		let colorCheck = check.find(k => k["piece"].charAt(0) == color)

		if (allMoves[color].length == 0 && !colorCheck) {
			return 0
		} else if (allMoves[color].length == 0 && colorCheck) {
			return 1
		} else {
			let matCheck = true, patCheck = true
			let iterator = getPiecesMovements(color)
			let piece = new Object()

			for (;;) {
				let value = iterator.next().value

				if (!value) break

				if (typeof value == "object") {
					piece = value
				} else {
					let pieceCoords = getCoords(piece["id"])
					if (!game[pieceCoords["y"]][pieceCoords["x"]]["piece"]) continue

					let coords = getCoords(value)

					let test = isCheck({
						color: game[coords["y"]][coords["x"]]["color"],
						piece: piece["piece"],
						id: value
					}, piece)

					let checkEnemy = check.find(k => k["piece"].charAt(0) == color)
					let enemy = test.find(k => k["piece"].charAt(0) == color)

					if (test.length == 0) {
						matCheck = false
						patCheck = false
						break
					}

					if (patCheck && checkEnemy && Object.keys(checkEnemy).length != 0 && (!enemy || Object.keys(enemy).length != 0)) patCheck = false
					if (matCheck && (!enemy || Object.keys(enemy).length == 0)) matCheck = false
					if (!patCheck && !matCheck) break
				}
			}

			if (patCheck) return 0
			if (matCheck) return 1
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
 * @param {boolean=} enpassant Prise en passant
 * @returns {string} Notation anglaise
 */
function log(from, to, castle = false, promotion = false, enpassant = false) {
	let res = new String()

	if (castle) {
		if (from["id"] < to["id"]) {
			return "O-O"
		} else {
			return "O-O-O"
		}
	} else {
		if (enpassant) {
			res += "e.p. "
			to["piece"] = (from["piece"].charAt(0) == "w" ? "b" : "w") + "pawn"
		}

		res += names[from["piece"].slice(1)][1]

		for (let piece of pieces) {
			if (piece["piece"] == from["piece"] && piece["id"] != from["id"]) {
				let coords = getCoords(to["id"])
				let moves = getMoves(piece, false, false)

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
 * @param {object} from Case incluant color, piece, id
 * @param {object} to Case incluant color, piece, id
 * @param {boolean=} castle Roque effectué
 * @param {boolean|string=} promotion Pion à promotion
 * @param {boolean=} enpassant Prise en passant
 */
function setLogs(from, to, castle = false, promotion = false, enpassant = false) {
	if (!logs[turns["move"]]) {
		logs[turns["move"]] = new Array()
	}

	let logged = log(from, to, castle, promotion, enpassant)
	let infos = document.getElementById("infos")

	logs[turns["move"]].push(logged)

	let turn = document.getElementById(turns["move"] + "_")

	if (!turn) {
		turn = document.createElement("tr")
		turn.id = turns["move"] + "_"
		turn.className = "logrow"

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

/**
 * Purger les logs
 */
function clearLogs() {
	let table = document.getElementById("infos")
	document.querySelectorAll(".logrow").forEach(r => table.removeChild(r))
}

/*
Liste de choses à faire :
Y'aura le joueur vs AI
Y'aura un système pour progresser
Y'aura éventuellement un système de stats
fermer ma gueule et doublé le code car le nv est insuffisant (t'es une merde !)2/40 coeff 20 peux mieu faire
Utiliser des class ? (pions, cases, moves, ...)
*/
