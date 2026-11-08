# Desenhos dos exercícios

Desenhos próprios do Diário: corpo em traço, com o músculo trabalhado em vermelho. Os GIFs prontos ficam em `docs/desenhos/`.

## Como refazer um exercício
1. Baixar o Blender 4.2 portátil (grátis).
2. Ajustar o exercício em `exs.py` (pose, câmera, aparelho e músculos).
3. Apagar os quadros antigos dele, se houver, e gerar: `blender --background --python gera.py -- final nome-do-exercicio`
   Sem nome, gera todos (cerca de 1 hora). Quadros que já existem são pulados.
4. Montar os GIFs e as folhas de conferência: `python gifs2.py` (precisa do Pillow). Sempre refaz todos os GIFs a partir dos quadros em `saida/final`.
5. Copiar os GIFs para `docs/desenhos/`.

Exercício novo também precisa de uma regra de nome em `ligar.js`; as regras publicadas ficam em `docs/metodos/imagens.json`, chave `desenhos`.

## Cuidados
- GIF guarda poucas cores: `gifs2.py` reserva os tons de vermelho na paleta. Sem isso, o vermelho some nos músculos de área pequena.
- Procurar quadros pelo nome exato (`nome-00.png`): "prancha" não pode pegar "prancha-lateral".
- Não copiar nem decalcar imagens de bancos pagos. A base do corpo é do MakeHuman (CC0, ver `mh/licenses.txt`).
