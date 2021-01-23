const movePath = 'url("../assets/chess/move.png")'
const moveColor = "#00b2ff"
const size = 100

let game = new Array()
let eaten = new Array()
let pieces = new Array()
let scores = {
	"w": 0,
	"b": 0
}
let id = 0
let castling = {
	"qside": new Array(),
	"kside": new Array(),
	"kings": new Array()
}
let selected = new Object()
let turns = {
	w: 1,
	b: -1,
	current: 1
}
let names = {
	"pawn": "pion",
	"knight": "cavalier",
	"bishop": "fou",
	"rook": "tour",
	"queen": "dame",
	"king": "roi"
}

function switchTheme() {
	let themes = document.getElementById("themes")

	themes.style.visibility = "hidden"
	alert("Faux bouton haha (en vrai je l'ai pas programmé (le mode jour n'est rien de plus qu'un fond blanc de qualité médiocre))")
	return

	console.log(document.body.classList)

	switch (themes.value) {
		case "Mode nuit":
			document.body.classList.value = "dark"
			themes.value = "Mode jour"
			theme = "dark"
			break
		
		case "Mode jour":
			document.body.classList.value = "light"
			themes.value = "Mode nuit"
			theme = "light"
			break
	}
}

// Afin d'optimiser, essayer de réduire au maximum les boucles (par exemple, dans le check du setMove, on n'a besoin que des pièces de l'adversaire)

function init() {
	for (let i = 0; i < 8; i++) {
		game.push(new Array())
	
		for (let j = 0 + i % 2; j < 8 + i % 2; j++) {
			let pushed = {
				// color: (j % 2 == 0 ? "#fafafa" : "#564439"),
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
			document.write("<div id='" + pushed.id + "'"
			+ "onclick='clicked(" + pushed.id + ")'"
			+ "style='display: inline-block;"
			+ "vertical-align: top;"
			+ (pushed.piece ? "background: url(\"../assets/chess/" + pushed.piece + ".png\"), " + pushed.color + ";" : "background-color: " + pushed.color + ";")
			+ "background-repeat: no-repeat;"
			+ "background-origin: content-box;"
			+ "background-position: center;"
			+ "height: " + size + "px;"
			+ "width: " + size + "px;'></div>")

			// Mettre tout ca dans le CSS
			
			id++
		}
		
		document.write("<br>")
	}
	
	document.write("<br><br><br><p id='infos'></p>")

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
}

function update() {
	for (let y in game) {
		for (let x in game[y]) {
			document.getElementById(game[y][x].id.toString()).style.backgroundImage = (game[y][x].piece ? "url('../assets/chess/" + game[y][x].piece + ".png')" : null)
		}
	}
}

init()

function clicked(id) {
	let coords = getCoords(id)
	let cell = game[coords["y"]][coords["x"]]

	console.log("Cell : ", cell)

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

		selected = new Object()
		turns["current"] *= -1

		update()
	} else if (selected != cell && cell["piece"] && turns[cell["piece"].charAt(0)] == turns["current"]) {
		selected = cell
		hideMoves()
		showMoves(cell)
	} else {
		if (Object.keys(selected).length != 0 && getMoves(selected).some(e => e == cell["id"])) {
			setMove(selected, cell).then(res => {
				console.log("C'est réussi bg :", res)
			}).catch(err => {
				console.log("C'est raté :", err)
			})
		}
	}
}

function showMoves(cell) {
	// Afficher les mouvements possibles sur l'échiqier

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

function hideMoves() {
	// Cacher les mouvements possibles sur l'échiqier

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

function getCoords(id) {
	return {
		y: Math.floor(id / game.length),
		x: id % game.length
	}
}

function getCell(ref, y, x) {
	ref += Math.floor(y * 8) + x
	
	if (ref < 0) return null

	coords = getCoords(ref)

	if (coords["x"] >= 8 || coords["x"] < 0 || coords["y"] >= 8 || coords["y"] < 0) return null

	return game[coords["y"]][coords["x"]]
}

function getMoves(cell, castlingCheck = true) {
	// Calculer les mouvements possibles
	// Retourner tous les coups possibles dans un array
	let res = new Array()

	switch (cell["piece"].substring(1, cell.end)) {
		case "pawn":
			// Faire la promotion

			let row = Math.floor(cell["id"] / game.length)

			if (cell["piece"].charAt(0) == "b") {
				let gcell = getCell(cell["id"], 1, 0)
				let cells = [getCell(cell["id"], 1, 1), getCell(cell["id"], 1, -1)]

				for (let ccell of cells) {
					if (ccell && ccell["piece"] && ccell["piece"].charAt(0) === (turns["current"] == 1 ? "b" : "w")) {
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
					if (cell && cell["piece"] && cell["piece"].charAt(0) == "b") res.push(cell["id"])
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

// En passant

function castle(cell) {
	let res = new Array()

	console.log("Castling :", cell)

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

function promotion(cell, idBefore) {
	return new Promise((resolve, reject) => {
		let choices = ["cavalier", "fou", "tour", "dame"]
		let pro = prompt("Choisissez une pièce [" + choices.join("/") + "] :").toLowerCase()

		if (!choices.includes(pro)) {
			return reject(false)
		} else {
			let coords = getCoords(cell["id"])
			let newPiece = cell["piece"].charAt(0) + Object.keys(names).find(e => names[e] == pro)

			game[coords["y"]][coords["x"]]["piece"] = newPiece

			pieces.push({
				color: cell["color"],
				piece: newPiece,
				id: cell["id"]
			})

			return resolve(true)
		}
	})
}

function setMove(from, to) {
	return new Promise(async (resolve, reject) => {
		let checks = isCheck({
			color: to["color"],
			piece: from["piece"],
			id: to["id"]
		}, from)

		console.log("Echec :", checks)

		if (checks.length != 0 && checks.some(e => e["piece"].charAt(0) == selected["piece"].charAt(0))) {
			return reject(false)
		} else {
			let fromCoords = getCoords(from["id"])
			let toCoords = getCoords(to["id"])

			if (to["piece"]) eat(to)

			if (from["piece"].slice(1) == "pawn" && ((Math.floor(to["id"] / game.length) == 0 && from["piece"].charAt(0) == "w") || (Math.floor(to["id"] / game.length == 7) && from["piece"].charAt(0) == "b"))) {
				let pro = {
					color: to["color"],
					piece: from["piece"],
					id: to["id"]
				}

				promotion(pro, from["id"]).then(res => {
					game[fromCoords["y"]][fromCoords["x"]]["piece"] = null
					pieces.splice(pieces.indexOf(pieces.find(e => e == from)), 1)
					update()
				}).catch(err => {
					return reject(false)
				})
			} else {
				game[toCoords["y"]][toCoords["x"]]["piece"] = selected["piece"]
				game[fromCoords["y"]][fromCoords["x"]]["piece"] = null

				pieces.splice(pieces.indexOf(pieces.find(e => e == from)), 1)
				pieces.push(to)

				for (let type in castling) {
					if (castling[type].some(e => e[0] == from["id"])) {
						let pos = castling[type].indexOf(castling[type].find(e => e[0] == from["id"]))
						castling[type].splice(pos, 1)
					}
				}

				update()
			}

			selected = new Object()
			turns["current"] *= -1

			return resolve(true)
		}
	})
}

function eat(cell) {
	// Mettre le pion de côté et le noter

	console.log("mangé : " + cell["piece"])
	pieces.splice(pieces.indexOf(pieces.find(e => e == cell)), 1)
	eaten.push(cell["piece"])
	addPoints(cell["piece"]) // A travailler
	let color = cell["piece"].charAt(0) == "w" ? "noir" : "blanc"
	document.getElementById("infos").innerHTML += "<b>" + cell["piece"].substring(1, cell["piece"].length) + " " + (color == "noir" ? "blanc" : "noir") + "</b> mangé par joueur <b>" + color + "</b>.<br>"
}

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

// Fonction non fonctionnelle parfois

function isCheck(newMove = false, from = false) {
	// Je vérifie juste si l'un des roi est échec dans un context donné et je renvoie si oui ou non
	// newMove est false ou cell, le coup qu'on prévoit de faire (qu'on n'a pas encore fait)
	// Deux rois ne peuvent pas être échecs en même temps

	let check = new Array()
	let context = [...pieces]

	if (newMove) {
		let coords = getCoords(newMove["id"])
		if (game[coords["y"]][coords["x"]]["piece"]) context.splice(context.indexOf(context.find(e => e["id"] == newMove["id"])), 1)
		context.splice(context.indexOf(context.find(e => e == from)), 1)
		context.push(newMove)
	}

	console.log("Context :", context)

	for (let piece of context) {
		if (newMove) {
			if (piece["piece"].charAt(0) != newMove["piece"].charAt(0)) {
				for (let e of getMoves(piece, false)) {
					for (let c of context) {
						if (c["id"] == e && c["piece"].substring(1, c["piece"].length) == "king") check.push(c) && console.log(piece)
					}
				}
			}
		} else {
			for (let e of getMoves(piece, false)) {
				for (let c of context) {
					if (c["id"] == e && c["piece"].substring(1, c["piece"].length) == "king") check.push(c) && console.log(piece)
				}
			}
		}
	}

	return check

	// document.getElementById("infos").innerHTML += "<br><b>Le joueur " + (turns["current"] == 1 ? "blanc" : "noir") + " a gagné !</b>"
}

/*

Liste de choses à faire :
Y'a le 2 joueurs local
Y'aura le joueur vs IA
Y'aura le jeu en ligne
Y'aura un système pour progresser
Y'aura éventuellement un système de stats
Utiliser des class ? (pions, cases, moves, ...)

*/