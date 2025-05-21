const firebaseConfig = firebase.initializeApp({
  apiKey: 'AIzaSyBOIX7t9Xuu5cgFNwUYfBcwZtk8ZcHTr-k',
  authDomain: 'camp-bomb.firebaseapp.com',
  databaseURL: 'https://camp-bomb-default-rtdb.firebaseio.com/',
  projectId: 'escala-pnae',
  storageBucket: 'camp-bomb.firebasestorage.app',
  messagingSenderId: '215802828608',
  appId: '1:215802828608:web:e24a4db1d6b7b41087cca5'
})

var database = firebase.database()

let menu = document.getElementById('menu')
let game = document.getElementById('game')

let submit = document.getElementById('submitForm')
let nameInpt = document.getElementById('nameInpt')
let codeInpt = document.getElementById('codeInpt')

let spaces = document.querySelector('.spaces-container .spaces')
let difficulty = 2

let isOwner = false
let isClient = false
let playerLifeNb = 0

let roomID
let yourTurn = false
let loadAgain = true
let firstTurn = true
let gameStart = false
let localPlayerId // Variável para armazenar o ID do jogador local

let btnStart = document.getElementById('btnStart')
let playerOrder

let isPlantingBomb = false // Controla se o jogador está escolhendo onde plantar a bomba
let lastFlippedIndex = null // Salva o índice do espaço virado no primeiro clique

/*
const roomData = {
  gameState: {
    currentTurn: localPlayerId,
    round: 1,
    playersOrder: [localPlayerId],
    flippedSpaces: [],
    bombsPositions: [],
    addedBombs: []
  },
  players: {
    [localPlayerId]: {
      lives: 3,
      isAlive: true
    }
  }
}*/

function generateRandomID() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let id = ''
  for (let i = 0; i < 6; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return id
}

function generateRoomID() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  let result = ''

  // Gera 6 letras aleatórias
  for (let i = 0; i < 6; i++) {
    result += letters.charAt(Math.floor(Math.random() * letters.length))
  }

  return result
}

async function isRoomIDUnique(id) {
  const snapshot = await database.ref('rooms/' + id).once('value')
  return !snapshot.exists()
}

async function generateUniqueRoomID() {
  let id
  let attempts = 0
  const maxAttempts = 10 // Prevenção contra loop infinito

  do {
    id = generateRoomID()
    attempts++
    if (attempts >= maxAttempts) {
      throw new Error(
        'Não foi possível gerar um ID único após várias tentativas'
      )
    }
  } while (!(await isRoomIDUnique(id)))

  return id
}

submit.addEventListener('click', function (e) {
  e.preventDefault()

  if (nameInpt.value.trim() === '') {
    alert('Por favor, insira seu nome')
    return
  }

  if (codeInpt.value.trim() === '') {
    isOwner = true
    isClient = false
    createRoom()
  } else {
    isOwner = false
    isClient = true
    roomID = codeInpt.value.trim().toUpperCase()
    joinRoom(codeInpt.value.trim().toUpperCase())
  }
})

async function createRoom() {
  try {
    // Gerar ID único para a sala
    roomID = await generateUniqueRoomID()
    localPlayerId = generateRandomID() // ID único para o jogador

    // Criar objeto da sala no Firebase
    const roomData = {
      id: roomID,
      owner: nameInpt.value,
      players: {
        [localPlayerId]: {
          id: localPlayerId,
          name: nameInpt.value,
          isOwner: true,
          lifes: 3,
          yourTurn: false
        }
      },
      createdAt: firebase.database.ServerValue.TIMESTAMP,
      status: 'waiting',
      maxPlayers: 8
    }

    // Salvar no Firebase
    await database.ref('rooms/' + roomID).set(roomData)

    // Atualizar UI
    menu.classList.add('hidden')
    game.classList.remove('hidden')

    // Exibir o código da sala
    document.getElementById('roomCode').textContent = roomID

    // Adicionar o dono da sala à lista de jogadores
    const peoplesLeft = document.querySelector('.peoplesLeft')
    peoplesLeft.innerHTML = ''

    // Configurar listeners da sala
    setupRoomListeners(roomID)
  } catch (error) {
    console.error('Erro ao criar sala:', error)
    alert('Erro ao criar sala. Por favor, tente novamente.')
  }
}

async function joinRoom(roomID) {
  try {
    // Validação básica do código da sala
    roomID = roomID.trim().toUpperCase()
    if (roomID.length !== 6) {
      throw new Error('O código da sala deve ter exatamente 6 caracteres')
    }

    // Validação do nome do jogador
    const playerName = nameInpt.value.trim()
    if (!playerName) {
      throw new Error('Por favor, insira seu nome')
    }

    // Verificar se a sala existe no Firebase
    const roomRef = database.ref('rooms/' + roomID)
    const snapshot = await roomRef.once('value')

    if (!snapshot.exists()) {
      throw new Error('Sala não encontrada. Verifique o código.')
    }

    const roomData = snapshot.val()

    // Verificar status da sala
    if (roomData.status !== 'waiting') {
      throw new Error('Esta sala já está em jogo e não aceita novos jogadores')
    }

    // Verificar limite de jogadores
    const currentPlayers = roomData.players
      ? Object.keys(roomData.players).length
      : 0
    const maxPlayers = roomData.maxPlayers || 8
    if (currentPlayers >= maxPlayers) {
      throw new Error(`Sala cheia (${currentPlayers}/${maxPlayers} jogadores)`)
    }

    // Verificar se o nome já está em uso
    if (roomData.players) {
      const nameExists = Object.values(roomData.players).some(
        player => player.name.toLowerCase() === playerName.toLowerCase()
      )
      if (nameExists) {
        throw new Error('Já existe um jogador com este nome na sala')
      }
    }

    // Gerar ID único para o jogador
    localPlayerId = generateRandomID()

    // Criar objeto do jogador
    const playerData = {
      id: localPlayerId,
      name: playerName,
      isOwner: false,
      yourTurn: false,
      lifes: 3
    }

    // Adicionar jogador à sala no Firebase
    await roomRef.child('players/' + localPlayerId).set(playerData)

    // Atualizar UI
    menu.classList.add('hidden')
    game.classList.remove('hidden')

    // Exibir código da sala
    document.getElementById('roomCode').textContent = roomID

    // Limpar e recarregar lista de jogadores
    const peoplesLeft = document.querySelector('.peoplesLeft')
    peoplesLeft.innerHTML = ''

    // Configurar listeners em tempo real
    setupRoomListeners(roomID)

    // Atualizar título da página com o código da sala
    document.title = `Sala ${roomID}`
  } catch (error) {
    console.error('Erro ao entrar na sala:', error)

    // Feedback visual de erro
    const submitBtn = document.getElementById('submitForm')
    submitBtn.textContent = 'Erro! Clique para tentar novamente'
    submitBtn.style.backgroundColor = '#ff4444'

    setTimeout(() => {
      submitBtn.textContent = 'Entrar na Sala'
      submitBtn.style.backgroundColor = ''
    }, 2000)

    alert(error.message)
  }
}

function setupRoomListeners(roomID) {
  const roomRef = database.ref('rooms/' + roomID)

  // Listener para jogadores
  roomRef.child('players').on('child_added', snapshot => {
    const player = snapshot.val()
    addPlayerToUI(player)

    // Mostrar btnStart para o dono quando houver 2+ jogadores
    if (isOwner) {
      roomRef.child('players').once('value', playersSnapshot => {
        if (playersSnapshot.numChildren() >= 2) {
          document.getElementById('btnStart').classList.remove('hidden')
        }
      })
    }
  })

  // No setupRoomListeners(), substitua o listener por:
  database.ref(`rooms/${roomID}/gameState`).on('value', async snapshot => {
    const gameState = snapshot.val()

    if (!gameState) {
      turnIndicator.textContent = 'Aguardando início do jogo...'
      return
    }

    const currentPlayerId = gameState.yourTurn
    yourTurn = currentPlayerId === localPlayerId

    if (yourTurn) {
      turnIndicator.textContent = 'SUA VEZ!'
      turnIndicator.className = 'your-turn'
    } else {
      try {
        const playerSnapshot = await database
          .ref(`rooms/${roomID}/players/${currentPlayerId}`)
          .once('value')
        const player = playerSnapshot.val()

        turnIndicator.textContent = player?.isOwner
          ? `Vez do ${player.name}`
          : `Vez de ${player?.name || 'Jogador'}`
        turnIndicator.className = player?.isOwner ? 'host-turn' : 'other-turn'
      } catch (error) {
        turnIndicator.textContent = 'Carregando...'
      }
    }
  })

  // Atualize o listener do gameState/yourTurn
  database
    .ref(`rooms/${roomID}/gameState/yourTurn`)
    .on('value', async snapshot => {
      const currentPlayerId = snapshot.val()

      if (!currentPlayerId) {
        turnIndicator.textContent = 'Aguardando início do jogo...'
        return
      }

      const isCurrentPlayer = currentPlayerId === localPlayerId
      yourTurn = isCurrentPlayer

      if (isCurrentPlayer) {
        turnIndicator.textContent = 'SUA VEZ!'
        turnIndicator.className = 'your-turn'
        document
          .querySelectorAll('.space')
          .forEach(s => (s.style.pointerEvents = 'auto'))
      } else {
        document
          .querySelectorAll('.space')
          .forEach(s => (s.style.pointerEvents = 'none'))

        try {
          const playerSnapshot = await database
            .ref(`rooms/${roomID}/players/${currentPlayerId}`)
            .once('value')
          const playerData = playerSnapshot.val()

          if (playerData) {
            turnIndicator.textContent = playerData.isOwner
              ? 'Vez do HOST'
              : `Vez de ${playerData.name}`
            turnIndicator.className = playerData.isOwner
              ? 'host-turn'
              : 'other-turn'
          }
        } catch (error) {
          console.error('Erro ao buscar jogador:', error)
          turnIndicator.textContent = 'Vez de outro jogador'
        }
      }
    })

  // Adicione também esta verificação no início para o estado inicial
  async function updateInitialTurnIndicator() {
    const gameStateSnapshot = await database
      .ref(`rooms/${roomID}/gameState`)
      .once('value')

    if (!gameStateSnapshot.exists()) {
      turnIndicator.textContent = 'Aguardando jogadores...'
      turnIndicator.style.fontStyle = 'italic'
    }
  }

  // Adicione no setupRoomListeners():
  database
    .ref(`rooms/${roomID}/gameState/flippedSpaces`)
    .on('value', async snapshot => {
      const flippedSpaces = snapshot.val() || []
      const bombPositions = await getBombPositionsFromDB(roomID)

      document.querySelectorAll('.space').forEach((space, index) => {
        if (flippedSpaces.includes(index)) {
          space.classList.add('flipped')
          const front = space.querySelector('.front')
          const back = space.querySelector('.back')

          back.classList.add('hidden')
          front.style.transform = 'rotateY(0deg)'

          // Atualiza visualização da bomba para TODOS os jogadores
          if (bombPositions.includes(index)) {
            space.classList.add('space-bomb')
            front.style.background = 'rgb(213, 63, 63)'
            front.innerHTML = '<img src="img/bomb.png">'
          }
        }
      })
    })

  roomRef.child('players').on('child_changed', snapshot => {
    const updatedPlayer = snapshot.val()
    updatePlayerLivesUI(updatedPlayer.id, updatedPlayer.lifes)
  })

  // Chame essa função quando o jogador entrar na sala
  updateInitialTurnIndicator()
}

function updatePlayerLivesUI(playerId, newLives) {
  const playerElement = document.getElementById(playerId)
  if (!playerElement) return

  const lifesContainer = playerElement.querySelector('.lifes')
  lifesContainer.innerHTML = '' // Limpa os corações existentes

  // Adiciona os corações de acordo com as vidas restantes
  for (let i = 0; i < newLives; i++) {
    const lifeElement = document.createElement('div')
    lifeElement.className = 'life'
    lifesContainer.appendChild(lifeElement)
  }

  // Efeito visual ao perder vida (opcional)
  if (newLives < playerLifeNb) {
    lifesContainer.classList.add('shake')
    setTimeout(() => lifesContainer.classList.remove('shake'), 500)
  }
  playerLifeNb = newLives // Atualiza o contador local
}

function getCurrentFlippedSpaces() {
  return Array.from(document.querySelectorAll('.back.hidden'))
    .map((el, index) => (el.classList.contains('hidden') ? index : -1))
    .filter(index => index !== -1)
}

function addPlayerToUI(player) {
  const peoplesLeft = document.querySelector('.peoplesLeft')
  const playerElement = document.createElement('div')
  playerElement.id = player.id
  playerElement.className = `people ${player.isOwner ? 'owner' : ''}`
  playerElement.innerHTML = `
    <h2>${player.name}</h2>
    ${player.isOwner ? '<span>Dono</span>' : ''}
    <div class="lifes" data-life="${player.name}Lifes">
    <div class="life"></div>
    <div class="life"></div>
    <div class="life"></div>
    </div>
  `

  let life = document.querySelectorAll('.life')
  playerLifeNb = life.length
  peoplesLeft.appendChild(playerElement)
}

function removePlayerFromUI(playerId) {
  const playerElement = document.getElementById(playerId)
  if (playerElement) {
    playerElement.remove()
  }
}

//////////////////////////////////////
//////////////////////////////////////
//////////////////////////////////////
//////////////////////////////////////

let howManyQuant = 0

async function setupHowMany(roomID) {
  const snapshot = await database.ref(`rooms/${roomID}`).once('value')
  const { players } = snapshot.val()
  const qtdPlayers = Object.keys(players).length

  const configs = {
    2: { howMany: 36, grid: 6, space: 4.5 },
    3: { howMany: 49, grid: 7, space: 3.7 },
    4: { howMany: 64, grid: 8, space: 3.0 },
    5: { howMany: 81, grid: 9, space: 2.5 },
    6: { howMany: 100, grid: 10, space: 2.0 },
    7: { howMany: 121, grid: 11, space: 1.8 },
    8: { howMany: 144, grid: 12, space: 1.5 }
  }

  const { howMany, grid, space } = configs[qtdPlayers] || configs[2]

  // 1. Mantém a definição do howManyQuant COMO ESTAVA (sem window.)
  howManyQuant = howMany

  // 2. **CORREÇÃO PRINCIPAL**: Aplica as variáveis APENAS no .spaces-container
  const container = document.querySelector('.spaces-container')
  container.style.setProperty('--space-size', `${space}rem`)
  container.style.setProperty('--grid-columns', grid)
}

async function loadSpaces() {
  spaces.innerHTML = ''
  await setupHowMany(roomID)

  const flippedSpacesSnapshot = await database
    .ref(`rooms/${roomID}/gameState/flippedSpaces`)
    .once('value')
  const flippedSpaces = flippedSpacesSnapshot.val() || []

  for (let i = 0; i < howManyQuant; i++) {
    const space = document.createElement('div')
    space.className = 'space'
    space.innerHTML = `
      <div class="front"></div>
      <div class="back"></div>
    `

    if (flippedSpaces.includes(i)) {
      space.classList.add('flipped')
      space.querySelector('.back').classList.add('hidden')

      // Só mostra bomba se estiver no Firebase E já foi clicado
      const bombPositions = await getBombPositionsFromDB(roomID)
      if (bombPositions.includes(i)) {
        space.classList.add('space-bomb')
        const front = space.querySelector('.front')
        front.style.background = 'rgb(213, 63, 63)'
        front.innerHTML = '<img src="img/bomb.png">'
      }
    }

    spaces.appendChild(space)
  }

  if (isOwner) {
    await initializeBombs() // Inicializa bombas aleatórias (apenas host)
  }

  putClick()
}

async function loadSpacesClient() {
  const bombPositions = await getBombPositionsFromDB(roomID)
  const flippedSpacesSnapshot = await database
    .ref(`rooms/${roomID}/gameState/flippedSpaces`)
    .once('value')
  const flippedSpaces = flippedSpacesSnapshot.val() || []
  await setupHowMany(roomID)
  for (let i = 0; i < howManyQuant; i++) {
    const space = document.createElement('div')
    space.className = 'space'
    space.innerHTML = `
        <div class="front"></div>
        <div class="back"></div>
      `

    if (bombPositions.includes(i)) {
      space.classList.add('space-bomb')
      const front = space.querySelector('.front')
      front.style.background = 'rgb(213, 63, 63)'
      front.innerHTML = '<img src="img/bomb.png">'
    }

    // Se a carta já estava virada, aplicar estado
    if (flippedSpaces.includes(i)) {
      space.classList.add('flipped')
      space.querySelector('.back').classList.add('hidden')
      space.querySelector('.front').style.transform = 'rotateY(0deg)'
    }

    spaces.appendChild(space)
  }

  putClick()
  putImg()
}

async function getBombPositionsFromDB(roomID) {
  try {
    const snapshot = await database
      .ref(`rooms/${roomID}/gameState/bombsPositions`)
      .once('value')
    return snapshot.val() || []
  } catch (error) {
    console.error('Erro ao pegar bombas:', error)
    return []
  }
}

async function initializeBombs() {
  let max = 35
  let min = 5 * difficulty
  const bombPositions = []

  if (min > 35) min = 35

  for (let i = 0; i < min; i++) {
    let randomIndex = Math.floor(Math.random() * (max - min + 1)) + min

    if (!bombPositions.includes(randomIndex)) {
      bombPositions.push(randomIndex)
    } else {
      i--
    }
  }

  await database
    .ref(`rooms/${roomID}/gameState/bombsPositions`)
    .set(bombPositions)
}

function putImg() {
  let spaces = document.querySelectorAll('.space-bomb')
  spaces.forEach(space => {
    let frontbombs = space.querySelectorAll('.front')
    frontbombs.forEach(bomb => {
      bomb.style.background = 'rgb(213, 63, 63)'
      bomb.innerHTML = `<img src="img/bomb.png">`
    })
  })
}

function putClick() {
  const spaces = document.querySelectorAll('.space')

  spaces.forEach((space, index) => {
    const back = space.querySelector('.back')
    const front = space.querySelector('.front')

    back.addEventListener('click', async function () {
      if (!yourTurn || space.classList.contains('flipped')) return

      // FASE 1: Virar espaço
      if (!isPlantingBomb) {
        const bombPositions = await getBombPositionsFromDB(roomID)
        const isBomb = bombPositions.includes(index)

        space.classList.add('flipped')
        await flipCard(back, front, index)

        if (isBomb) {
          await handleBombHit()
          await nextTurn(roomID)
        } else {
          isPlantingBomb = true
          lastFlippedIndex = index
          turnIndicator.textContent =
            'Clique em outro espaço para plantar uma bomba!'
        }
      }
      // FASE 2: Plantar bomba
      else {
        if (index === lastFlippedIndex) {
          turnIndicator.textContent =
            'Escolha um espaço DIFERENTE do que você acabou de virar!'
          return
        }

        const bombPositions = await getBombPositionsFromDB(roomID)
        if (!bombPositions.includes(index)) {
          await addBombToSpace(index)
          turnIndicator.textContent = 'Bomba plantada com sucesso!'
          isPlantingBomb = false
          await nextTurn(roomID)
        } else {
          isPlantingBomb = false
          await nextTurn(roomID) // Adicionado esta linha para passar a vez
        }
      }
    })
  })
}

async function handleBombHit() {
  const father = document.getElementById(localPlayerId)
  const lifes = father.querySelectorAll('.life')
  const playerRef = database.ref(`rooms/${roomID}/players/${localPlayerId}`)

  // 1. Reduz a vida do jogador
  await playerRef.update({
    lifes: firebase.database.ServerValue.increment(-1)
  })

  if (lifes.length > 0) {
    lifes[lifes.length - 1].remove()
  }

  // 2. Verifica se o jogador perdeu
  const snapshot = await playerRef.once('value')
  if (snapshot.val().lifes <= 0) {
    // Atualiza status do jogador
    await playerRef.update({ isAlive: false })
    turnIndicator.textContent = 'Você Perdeu!'

    // 3. Remove o jogador do playerOrder no Firebase
    const gameStateRef = database.ref(`rooms/${roomID}/gameState`)
    await gameStateRef.transaction(currentData => {
      if (!currentData) return

      // Remove o jogador da ordem de turnos
      const updatedPlayerOrder = (currentData.playerOrder || []).filter(
        playerId => playerId !== localPlayerId
      )

      // Atualiza o currentTurn se necessário
      let updatedCurrentTurn = currentData.currentTurn
      if (updatedCurrentTurn >= updatedPlayerOrder.length) {
        updatedCurrentTurn = 0
      }

      return {
        ...currentData,
        playerOrder: updatedPlayerOrder,
        currentTurn: updatedCurrentTurn,
        yourTurn: updatedPlayerOrder[updatedCurrentTurn] || null
      }
    })

    // 4. Remove o jogador da UI
    removePlayerFromUI(localPlayerId)
  }
}

async function setPlayerOrder(roomID) {
  const snapshot = await database.ref(`rooms/${roomID}/players`).once('value')
  const players = Object.keys(snapshot.val() || {})

  if (players.length > 0) {
    await database.ref(`rooms/${roomID}/gameState/playerOrder`).set(players)
    console.log('✅ Ordem de jogadores definida:', players)
  }
}

async function nextTurn(roomID) {
  const gameStateRef = database.ref(`rooms/${roomID}/gameState`)

  return gameStateRef.transaction(currentData => {
    if (!currentData) return

    const nextIndex =
      (currentData.currentTurn + 1) % currentData.playerOrder.length
    const nextPlayer = currentData.playerOrder[nextIndex]

    return {
      ...currentData,
      currentTurn: nextIndex,
      yourTurn: nextPlayer,
      round: currentData.round + (nextIndex === 0 ? 1 : 0)
    }
  })
}

async function flipCard(back, front, spaceIndex) {
  return new Promise(async resolve => {
    // Animação local
    back.style.animation = 'flipY 0.8s forwards'
    front.style.animation = 'flipY 0.8s forwards'

    setTimeout(async () => {
      back.classList.add('hidden')

      // Todos os jogadores atualizam o flippedSpaces, não apenas o host
      const gameStateRef = database.ref(`rooms/${roomID}/gameState`)
      await gameStateRef.transaction(currentData => {
        if (!currentData) return

        const flippedSpaces = currentData.flippedSpaces || []
        if (!flippedSpaces.includes(spaceIndex)) {
          flippedSpaces.push(spaceIndex)
        }

        return {
          ...currentData,
          flippedSpaces: flippedSpaces
        }
      })

      resolve()
    }, 600)
  })
}

async function addBombToSpace(spaceIndex) {
  const bombPositionsRef = database.ref(
    `rooms/${roomID}/gameState/bombsPositions`
  )

  await bombPositionsRef.transaction(currentBombs => {
    const updatedBombs = currentBombs || []
    if (!updatedBombs.includes(spaceIndex)) {
      updatedBombs.push(spaceIndex)
    }
    return updatedBombs
  })
}

/////////////////////////////////////////////////
/////////////////////////////////////////////////
/////////////////////////////////////////////////
/////////////////////////////////////////////////

btnStart.addEventListener('click', async function () {
  try {
    // 1. Obter a lista de jogadores do Firebase
    const playersSnapshot = await database
      .ref(`rooms/${roomID}/players`)
      .once('value')
    const players = playersSnapshot.val()

    // 2. Criar o array playerOrder com os IDs dos jogadores
    playerOrder = Object.keys(players)

    // 3. Inicializar o gameState se não existir
    const gameStateUpdate = {
      playerOrder: playerOrder,
      currentTurn: 0, // Índice no array
      yourTurn: playerOrder[0], // ID do primeiro jogador
      round: 1,
      flippedSpaces: [],
      bombsPositions: [] // Adicione outras propriedades necessárias
    }

    // 4. Atualizar no Firebase
    await database.ref(`rooms/${roomID}/gameState`).set(gameStateUpdate)

    // 5. Iniciar o jogo
    btnStart.classList.add('hidden')
    loadSpaces()
    yourTurn = playerOrder[0] === localPlayerId
    gameStart = true
    updateRoomStatus(roomID, 'playing')
  } catch (error) {
    console.error('Erro ao iniciar jogo:', error)
  }
})

async function getRoomStatusAsync(roomID) {
  try {
    const snapshot = await database.ref(`rooms/${roomID}/status`).once('value')
    return snapshot.val()
  } catch (error) {
    console.error('Erro ao recuperar status:', error)
    return null
  }
}

function updateRoomStatus(roomID, newStatus) {
  database
    .ref(`rooms/${roomID}/status`)
    .set(newStatus)
    .catch(error => console.error('Erro ao atualizar status:', error))
}

async function checkGameStart(roomID) {
  const status = await getRoomStatusAsync(roomID)
  if (status === 'playing') {
    gameStart = true
  }
}

setInterval(async () => {
  await checkGameStart(roomID)
}, 1000)

setInterval(() => {
  if (firstTurn && gameStart && isClient && loadAgain) {
    loadAgain = false
    realodBombIfNotYourTurn()
  }
}, 1000)

function realodBombIfNotYourTurn() {
  firstTurn = false
  loadSpacesClient()
}
