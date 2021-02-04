const movePath = 'url("../assets/chess/move.png")'
const moveColor = "#00b2ff"
const size = 100
const x = ["a", "b", "c", "d", "e", "f", "g", "h"]
const y = ["8", "7", "6", "5", "4", "3", "2", "1"]

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

// Afin d'optimiser, essayer de réduire au maximum les boucles (par exemple, dans le check du setMove, on n'a besoin que des pièces de l'adversaire)

/**
 * Initialiser le terrain
 */
function init() {
	let id = 0

	for (let i = 0; i < 8; i++) {
		game.push(new Array())
	
		for (let j = 0 + i % 2; j < 8 + i % 2; j++) {
			let pushed = {
				// color: (j % 2 == 0 ? "fafafa" : "564439"),
				color: (j % 2 == 0 ? "#fafafa" : "#614f45"),
				piece: null,
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
			cell.onclick = () => clicked(pushed["id"])

			pushed["piece"] 
				? cell.style.background = "url(\"../assets/chess/" + pushed["piece"] + ".png\"), " + pushed["color"] + ";"
				: cell.style.backgroundColor = pushed["color"]

			document.getElementById("board").appendChild(cell)

			// Mettre tout ca dans le CSS
			
			id++
		}
		
		document.getElementById("board").appendChild(document.createElement("br"))
	}

	for (let line of game) for (let p of line) if (p["piece"]) {
		let piece = p["piece"].substring(1, p["piece"].length)

		pieces.push(p)
		if (piece == "rook" || piece == "king") {
			if (line.indexOf(p) == 0) {
				castling["qside"].push([p["id"], p["piece"]])
			} else if (line.indexOf(p) == 7) {
				castling["kside"].push([p["id"], p["piece"]])
			} else castling["kings"].push([p["id"], p["piece"]])
		}
	}

	// Fonction à appeler lorsqu'on choisit un mode de jeu
	hideMoves()
}

/**
 * Mettre à jour le terrain
 */
function update() {
	for (let y in game) {
		for (let x in game[y]) {
			document.getElementById(game[y][x].id.toString()).style.backgroundImage = (game[y][x].piece ? "url('../assets/chess/" + game[y][x].piece + ".png')" : null)
		}
	}

	isCheck()
}

init()

/**
 * Retire les doublons de pieces
 */
const cleanPieces = () => pieces = Array.from(new Set(pieces))

/**
 * Evenement lors d'un click sur une case
 * @param {number} id ID de la case cliquée
 */
async function clicked(id) {
	let coords = getCoords(id)
	let cell = game[coords["y"]][coords["x"]]

	// console.log("Cliqué - selected : ", cell)

	if (Object.keys(selected) != 0 && selected != cell && selected["piece"].slice(1) == "king" && cell["piece"] && castle(selected).includes(cell["id"])) {
		let diff = selected["id"] - cell["id"]
		let kingCoords = getCoords(selected["id"])
		let rookCoords = getCoords(cell["id"])
		let newKing = kingCoords["x"] + 2 * (Math.sign(selected["id"] - cell["id"]) * -1)
		let newRook = rookCoords["x"] + (selected["id"] - cell["id"] - Math.sign(selected["id"] - cell["id"]))
		
		game[kingCoords["y"]][newKing]["piece"] = selected["piece"]
		game[kingCoords["y"]][kingCoords["x"]]["piece"] = null

		game[rookCoords["y"]][newRook]["piece"] = game[rookCoords["y"]][rookCoords["x"]]["piece"]
		game[rookCoords["y"]][rookCoords["x"]]["piece"] = null

		pieces.splice(pieces.indexOf(pieces.find(e => e == selected)), 1)
		pieces.splice(pieces.indexOf(pieces.find(e => e == cell)), 1)

		pieces.push(game[kingCoords["y"]][newKing])
		pieces.push(game[rookCoords["y"]][newRook])

		console.log(log(selected, game[kingCoords["y"]][newKing], true))

		selected = new Object()
		turns["current"] *= -1

		update()
	} else if (selected != cell && cell["piece"] != null && turns[cell["piece"].charAt(0)] == turns["current"]) {
		selected = cell
		hideMoves()
		showMoves(cell)
	} else if (Object.keys(selected).length != 0 && getMoves(selected).some(e => e == cell["id"])) {
		let previous = Object.assign({}, selected)
		let nextious = Object.assign({}, cell)

		setMove(previous, nextious).then(res => {
			selected = new Object()
			turns["current"] *= -1

			update()

			/*if (!ogs[turns["move"]]) {
				logs[turns["move"]] = new Array()
			}

			logs[turns["move"]].push()*/

			console.log(log(previous, nextious))

			if (cell["piece"].charAt(0) == "b") turns["move"]++
		}).catch(err => {
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
	for (let y of game) {
		for (let x of y) {
			let element = document.getElementById(x.id.toString())
			if (element.style.backgroundImage.startsWith(movePath) || element.style.borderColor != "none") {
				let cell = game[game.indexOf(y)][y.indexOf(x)]
				element.style.backgroundImage = cell["piece"] ? "url('../assets/chess/" + cell["piece"] + ".png')" : null
				element.style.borderStyle = "none"
			}
		}
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
 * @returns {(object|null)} Case désirée si existante
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
 * @param {boolean} context Rajouter aux pions les cases qu'ils menacent pour vérifier si le roi peut s'en approcher
 * @returns {array} Tableau contenant toutes les cases où peut aller la pièce demandée
 */
function getMoves(cell, castlingCheck = true, context = false) {
	let res = new Array()
	let contextGame = new Array()

	switch (cell["piece"].slice(1)) {
		case "pawn":
			// TODO: Utiliser la direction pour optimiser
			let direction = cell["piece"].charAt(0) == "w" ? -1 : 1
			let row = Math.floor(cell["id"] / game.length)

			if (cell["piece"].charAt(0) == "b") {
				let gcell = getCell(cell["id"], 1, 0)
				let cells = [getCell(cell["id"], 1, 1), getCell(cell["id"], 1, -1)]

				for (let ccell of cells) {
					if (ccell && ccell["piece"] && ccell["piece"].charAt(0) == (turns["current"] == 1 ? "b" : "w") && Math.abs(coords["y"] - row) == 1) {
						res.push(ccell["id"])
					}
				}

				if (gcell) {
					if (!gcell["piece"]) {
						res.push(gcell["id"])

						if (row == 1) {
							let extraCell = getCell(cell["id"], 2, 0)
							if (!extraCell["piece"]) res.push(extraCell["id"])
						}
					}
				}
			} else if (cell["piece"].charAt(0) == "w") {
				let gcell = getCell(cell["id"], -1, 0)
				let cells = [getCell(cell["id"], -1, 1), getCell(cell["id"], -1, -1)]

				for (let cell of cells) {
					let coords = getCoords(cell["id"])
					if (cell && cell["piece"] && cell["piece"].charAt(0) == "b" && Math.abs(coords["y"] - row) == 1) {
						res.push(cell["id"])
					}
				}

				if (gcell) {
					if (!gcell["piece"]) {
						res.push(gcell["id"])

						if (row == 6) {
							let extraCell = getCell(cell["id"], -2, 0)
							if (!extraCell["piece"]) res.push(extraCell["id"])
						}
					}
				}
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

	return res
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
// Utiliser éventuellement les logs des mouvements

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
 * Réaliser une promotion de pion
 * @param {object} cell Case incluant color, piece, id
 * @returns {promise} Promotion valide ou non
 */
function promotion(cell) {
	return new Promise((resolve, reject) => {
		let choices = ["cavalier", "fou", "tour", "dame"]
		let pro = prompt("Choisissez une pièce [" + choices.join("/") + "] :").toLowerCase()

		if (!choices.includes(pro)) {
			return reject(false)
		} else {
			let coords = getCoords(cell["id"])
			let newPiece = cell["piece"].charAt(0) + Object.keys(names).find(e => names[e][0] == pro)

			game[coords["y"]][coords["x"]]["piece"] = newPiece

			return resolve(true)
		}
	})
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

		waitingForValidMove = Object.assign({}, game[coords["y"]][coords["x"]])
		game[coords["y"]][coords["x"]]["piece"] = from["piece"]
		game[fromCoords["y"]][fromCoords["x"]]["piece"] = null

		pieces.splice(pieces.indexOf(pieces.find(e => e["id"] == from["id"])), 1)
		pieces.push(projected)

		let checks = isCheck(projected, from)

		if (checks.length != 0 && checks.some(e => e["piece"] == from["piece"].charAt(0) + "king")) {
			return reject(false)
		} else {
			if (waitingForValidMove["piece"]) eat(waitingForValidMove)

			if (from["piece"].slice(1) == "pawn" && ((Math.floor(to["id"] / game.length) == 0 && from["piece"].charAt(0) == "w") || (Math.floor(to["id"] / game.length == 7) && from["piece"].charAt(0) == "b"))) {
				promotion(projected).then(res => {
					game[fromCoords["y"]][fromCoords["x"]]["piece"] = null
				}).catch(err => {
					return reject(false)
				})
			} else {
				game[fromCoords["y"]][fromCoords["x"]]["piece"] = null

				for (let type in castling) {
					if (castling[type].some(e => e[0] == from["id"])) {
						let pos = castling[type].indexOf(castling[type].find(e => e[0] == from["id"]))
						castling[type].splice(pos, 1)
					}
				}

				return resolve(true)
			}
		}
	})
}

/**
 * Vérifier un état d'échec pour chaque roi
 * @param {(object|bool)=} newMove Faux si pas de nouveau mouvement, sinon case incluant color, piece, id
 * @param {(object|bool)=} from Faux si pas de nouveau mouvement, sinon case incluant color, piece, id
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
						game[fromCoords["y"]][fromCoords["x"]]["piece"] = null

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

			if (pat) return 0
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
						game[fromCoords["y"]][fromCoords["x"]]["piece"] = null

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
							mat = false
							return true
						}
					})

					if (!mat) break
				}
			}

			if (mat) return 1
		}
	}

	// console.log("Echec :", check, by)

	return check

	// document.getElementById("infos").innerHTML += "<br><b>Le joueur " + (turns["current"] == 1 ? "blanc" : "noir") + " a gagné !</b>"
}

/**
 * Manger une pièce
 * @param {string} piece Case prise incluant color, piece, id
 */
function eat(piece) {
	pieces.splice(pieces.indexOf(pieces.find(e => e["id"] == piece["id"])), 1)
	eaten.push(piece["piece"])
	addPoints(piece["piece"])
	let color = piece["piece"].charAt(0) == "w" ? "noir" : "blanc"
	document.getElementById("infos").innerHTML += "<b>" + names[piece["piece"].slice(1)][0] + " " + (color == "noir" ? "blanc" : "noir") + "</b> mangé par joueur <b>" + color + "</b>.<br>"
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

	scores[piece.charAt(0) == "w" ? "b" : "w"] += points[piece.substring(0, piece.length)]
}

/**
 * Récupère la notation d'un mouvement effectué
 * @param {object} from Case incluant color, piece, id
 * @param {object} to Case incluant color, piece, id
 * @param {boolean} castle Roque effectué
 * @returns {string} Notation anglaise
 */
function log(from, to, castle = false) {
	let res = new String()

	if (castle) {
		console.log(from)
		console.log(to)
		if (from["id"] < to["id"]) {
			return "O-O"
		} else {
			return "O-O-O"
		}
	} else {
		res += names[from["piece"].slice(1)][1]

		for (let piece of pieces) {
			if (piece["piece"] == from["piece"] && piece["id"] != from["id"]) {
				let moves = getMoves(piece, false, false)

				if (moves.includes(to["id"])) {
					res += x[from["id"] % game.length]
				}

				break
			}
		}

		if (to["piece"]) res += "x"

		res += x[to["id"] % game.length] + y[Math.floor(to["id"] / game.length)]

		let check = isCheck()

		if (typeof check == "number" && check == 1) {
			res += "#"
		} else if (check.length != 0) {
			res += "+"
		}
	}

	return res
}

/*
Liste de choses à faire :
Changer les substring en slice
Drag and drop
Speculative parsing
Y'a le 2 joueurs local
Y'aura le joueur vs IA
Y'aura le jeu en ligne
Y'aura un système pour progresser
Y'aura éventuellement un système de stats
Utiliser des class ? (pions, cases, moves, ...)
*/