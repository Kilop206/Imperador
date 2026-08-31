# Imperador - Bot do Discord (Tibério)

Bot do Discord em TypeScript com personalidade imperial que envia mensagens espontâneas e responde a usuários com base em contexto, frequência e múltiplos modos de comportamento.

## Funcionalidades Avançadas

- ✅ **Frases espontâneas** categorizadas (imperial, arrogante)
- ✅ **Respostas por palavra-chave** com múltiplas opções
- ✅ **Respostas por contexto** (combinações de palavras)
- ✅ **Respostas baseadas em frequência** (mudança com o tempo)
- ✅ **Sistema de raridade** para frases especiais (5% de chance)
- ✅ **7 Modos especiais**: Bêbado, Ameaça, Humor, Sério, Nostálgico, Filosófico, Romano
- ✅ **Triggers automáticos** baseados em padrões de conversa
- ✅ **Detecção automática de agressividade** para trigger de modo
- ✅ **Validação inteligente de respostas** (evita contradições como elogios em xingamentos)
- ✅ **Detecção de sarcasmo** para não responder sarcasmo como elogio
- ✅ **Comandos especiais** para controle de modos
- ✅ **Sistema de elogios** com respostas dedicadas
- ✅ **Sistema de permissões de canais** configurável
- ✅ **TypeScript** para type safety

## Pré-requisitos

- Node.js (v16 ou superior)
- npm ou yarn
- Token do bot do Discord (obtido em [Discord Developer Portal](https://discord.com/developers/applications))

## Instalação

1. Clone o repositório:
```bash
git clone <seu-repositorio>
cd Imperador
```

2. Instale as dependências:
```bash
npm install
```

3. Crie o arquivo `.env` baseado no `.env.example`:
```bash
cp .env.example .env
```

4. Configure o arquivo `.env` com suas informações:
```env
DISCORD_TOKEN=seu_token_aqui
ALLOWED_CHANNELS=channel_id_1,channel_id_2
MIN_INTERVAL=3600000
MAX_INTERVAL=7200000
```

5. Copie o arquivo de respostas:
```bash
cp tiberius_responses.json.example tiberius_responses.json
```

6. Edite o arquivo `tiberius_responses.json` com as respostas do Tibério (já pré-configurado com a personalidade imperial)

## Como obter os IDs dos canais

1. Ative o modo desenvolvedor no Discord (Configurações > Avançado > Modo Desenvolvedor)
2. Clique com o botão direito no canal desejado
3. Selecione "Copiar ID"

## Como obter o Token do Bot

1. Vá para o [Discord Developer Portal](https://discord.com/developers/applications)
2. Crie uma nova aplicação ou selecione uma existente
3. Vá para a aba "Bot"
4. Clique em "Add Bot"
5. Copie o token do bot

## Scripts

- `npm run dev` - Executa o bot em modo desenvolvimento com hot reload
- `npm run build` - Compila o TypeScript para JavaScript
- `npm start` - Executa o bot em produção (precisa ser compilado primeiro)

## Configuração

### Variáveis de Ambiente

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `DISCORD_TOKEN` | Token do bot do Discord | Obrigatório |
| `ALLOWED_CHANNELS` | IDs dos canais permitidos (separados por vírgula) | Obrigatório |
| `MIN_INTERVAL` | Intervalo mínimo entre mensagens em ms | 21600000 (8 horas) |
| `MAX_INTERVAL` | Intervalo máximo entre mensagens em ms | 43200000 (12 horas) |

### Sistema de Respostas (tiberius_responses.json)

Todas as respostas do Tibério são configuradas no arquivo `tiberius_responses.json` com as seguintes categorias:

#### 1. Frases Espontâneas (spontaneous)
- **imperial**: Frases grandiosas e autoritárias
- **arrogant**: Frases mais sarcásticas e condescendentes

#### 2. Palavras-chave (keywords)
Respostas para palavras específicas. Cada palavra pode ter:
- **Uma resposta única** (string): sempre a mesma resposta
- **Múltiplas respostas** (array): escolhe aleatoriamente

#### 3. Contexto (context)
Respostas para **combinações de palavras**. Exemplo: "ragnar" + "morrer" → resposta específica.

#### 4. Frequência (frequency)
Respostas que **mudam com o tempo**. Exemplo:
- 1ª menção de "Tártaro": resposta normal
- 5ª menção: resposta mais séria
- 10ª menção: resposta final "Não insista."

#### 5. Raridade (rarity)
Frases **muito raras** (5% de chance) que criam mistério:
- "...Eu me lembro de você."
- "Isso não deveria estar neste registro."
- "Não diga esse nome aqui."

#### 6. Modos Especiais (modes)
- **drunk**: Modo bêbado/humorístico
- **threat**: Modo ameaça imperial (ativado automaticamente por agressividade)
- **humor**: Modo humor (ativado por risadas/piadas)
- **serious**: Modo sério (ativado por temas graves)
- **nostalgic**: Modo nostálgico (ativado por memórias/passado)
- **philosophical**: Modo filosófico (ativado por questões existenciais)
- **roman**: Modo romano (ativado por temas romanos)

#### 7. Elogios (compliments)
Respostas especiais quando o bot detecta elogios.

### Comandos Especiais

O bot aceita os seguintes comandos nos canais permitidos:

- `!tiberio_caotico` ou `!tiberio_bebado` - Ativa modo bêbado
- `!tiberio_normal` - Reseta para modo normal
- `!tiberio_ameaca` - Ativa modo ameaça imperial
- `!tiberio_humor` - Ativa modo humor
- `!tiberio_serio` - Ativa modo sério
- `!tiberio_nostalgico` - Ativa modo nostálgico
- `!tiberio_filosofico` - Ativa modo filosófico
- `!tiberio_romano` - Ativa modo romano
- `!tiberio_status` - Mostra o modo atual e status dos triggers
- `!tiberio_raro` - Força uma frase rara
- `!tiberio_triggers` - Reseta os contadores de triggers

### Triggers Automáticos

O bot possui um sistema inteligente que detecta padrões nas conversas e ativa modos automaticamente:

**🍺 Modo Bêbado** (3 menções em 5 minutos):
- Palavras: festa, cerveja, álcool, bebida, drink, comemorar, celebrar, alegrar, felicidade, diversão, balada, noite, bar, pub, vinho, chopp, toast

**😄 Modo Humor** (3 menções em 5 minutos):
- Palavras: kkkk, hahaha, rsrs, piada, engraçado, rir, risada, humor, comédia, zueira, brincadeira, lol, lmao, haha, k

**😔 Modo Sério** (3 menções em 5 minutos):
- Palavras: morte, morrer, guerra, batalha, sangue, destruição, sofrimento, dor, tristeza, chorei, chorar, lágrimas, funeral, enterro, cataclismo, desastre, tragédia

**🥺 Modo Nostálgico** (3 menções em 5 minutos):
- Palavras: passado, antigo, antiga, lembrar, lembrança, saudade, memória, memórias, antigamente, antes, infância, juventude, tempos, história, recordar

**🤔 Modo Filosófico** (3 menções em 5 minutos):
- Palavras: vida, morte, sentido, existência, propósito, destino, fado, universo, cosmos, eternidade, tempo, realidade, verdade, consciência, alma, espírito

**🏛️ Modo Romano** (3 menções em 5 minutos):
- Palavras: senado, senador, legião, legionário, romano, romana, cesar, júlio, augusto, império, imperador, coliseu, gladiador, águia, aquila, latim, roma

**⚡ Modo Ameaça** (Já existente):
- Ativado automaticamente quando 3+ mensagens consecutivas contêm palavras agressivas
- Reset automático após mensagens não agressivas

## ⏱️ Duração dos Modos

Todos os modos especiais têm duração limitada e resetam automaticamente para o modo normal:

| Modo | Duração |
|------|---------|
| **Bêbado** | 10 minutos |
| **Ameaça** | 5 minutos |
| **Humor** | 15 minutos |
| **Sério** | 20 minutos |
| **Nostálgico** | 25 minutos |
| **Filosófico** | 30 minutos |
| **Romano** | 20 minutos |
| **Normal** | Indefinido (padrão) |

**Notas:**
- Quando um modo é ativado, o console mostra quanto tempo até expirar
- Modos podem ser alterados manualmente a qualquer momento com comandos
- `!tiberio_normal` reseta imediatamente para o modo padrão

## Estrutura do Projeto

```
Imperador/
├── src/
│   ├── config/
│   │   └── config.ts           # Configuração e validação
│   ├── services/
│   │   ├── scheduler.ts       # Serviço de agendamento de mensagens
│   │   ├── reply.ts           # Serviço de respostas automáticas
│   │   ├── contextAnalyzer.ts # Análise de contexto e frequência
│   │   ├── rarityManager.ts   # Sistema de frases raras
│   │   ├── modeManager.ts     # Gerenciamento de modos especiais
│   │   ├── triggerManager.ts  # Sistema de triggers automáticos
│   │   └── responseValidator.ts # Validação de consistência de respostas
│   └── index.ts               # Ponto de entrada do bot
├── tiberius_responses.json    # Todas as respostas do Tibério
├── .env.example               # Exemplo de configuração
├── package.json
├── tsconfig.json
└── README.md
```

## Como o Bot Funciona

1. **Conexão**: O bot se conecta ao Discord usando o token fornecido
2. **Scheduler**: Um serviço agenda o envio de mensagens espontâneas em intervalos aleatórios
3. **Seleção de Mensagem**: O bot escolhe entre categorias imperial/arrogant, com chance de frases raras
4. **Análise de Contexto**: O bot verifica combinações de palavras antes de palavras-chave individuais
5. **Rastreamento de Frequência**: O bot conta menções de palavras para mudar respostas ao longo do tempo
6. **Sistema de Triggers Automáticos**: O bot monitora padrões de conversa e ativa modos automaticamente
7. **Detecção de Agressividade**: O bot monitora linguagem agressiva para ativar modo ameaça
8. **Validação de Respostas**: O bot filtra respostas inapropriadas para evitar contradições (ex: não responde com elogio a xingamentos)
9. **Prioridade de Resposta**: Combinações > Agressividade > Elogios > Modos especiais > Palavras-chave > Frases raras
10. **Respostas**: O bot monitora mensagens nos canais permitidos e responde com base em múltiplos critérios

### Sistema Inteligente de Respostas

O bot possui um sistema de validação que evita contradições:

- **Mensagens agressivas**: O bot não responde com elogios ou frases positivas
- **Mensagens de elogio**: O bot não responde com frases agressivas ou ameaçadoras
- **Detecção de sarcasmo**: O bot identifica sarcasmo para não responder como elogio
- **Priorização de contexto**: Mensagens agressivas têm prioridade sobre palavras-chave normais
- **Filtragem dinâmica**: Respostas são filtradas em tempo real baseadas no contexto da mensagem

## Desenvolvimento

Para desenvolvimento com hot reload:

```bash
npm run dev
```

Para compilar e executar em produção:

```bash
npm run build
npm start
```

## Segurança

⚠️ **Importante**: Nunca compartilhe seu arquivo `.env` ou commit ele no controle de versão. O `.env` está incluído no `.gitignore` por padrão.

## Troubleshooting

### Bot não conecta
- Verifique se o token está correto
- Verifique se o bot tem as permissões necessárias no servidor
- Verifique se o bot está nos canais especificados

### Mensagens não são enviadas
- Verifique se os IDs dos canais estão corretos
- Verifique se o bot tem permissão para enviar mensagens nos canais
- Verifique o console para mensagens de erro

### Respostas não funcionam
- Verifique se o bot tem permissão para ler mensagens no canal
- Verifique se as palavras-chave estão configuradas corretamente
- Verifique se o formato JSON está correto

## Licença

ISC
