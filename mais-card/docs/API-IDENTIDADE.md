# Contrato da API de verificação de identidade

O app captura as imagens (componente `CameraCapture`) e as envia por `createHttpIdentityProvider`
(`src/services/identity.ts`). Toda a verificação acontece no backend. Base: `VITE_API_URL` + `/identity`.

Todas as rotas exigem o usuário autenticado (cookie de sessão ou `Authorization: Bearer`).
Respostas de erro usam `{ "erro": "mensagem" }` com o status HTTP adequado.

## 1. Abrir sessão

`POST /identity/sessions`

```json
{ "cpf": "123.456.789-01" }
```

Resposta `201`:

```json
{ "sessaoId": "sess_8f3a2c" }
```

A sessão agrupa documento e selfie de uma mesma tentativa. Expira em 30 minutos.

## 2. Enviar documento

`POST /identity/sessions/{sessaoId}/document` — `multipart/form-data`

| campo    | tipo   | valores                      |
|----------|--------|------------------------------|
| `tipo`   | texto  | `rg`, `cnh`, `rne`           |
| `lado`   | texto  | `frente`, `verso`            |
| `imagem` | arquivo| JPEG, até 8 MB               |

O backend deve:

1. Checar qualidade: nitidez, iluminação, bordas do documento visíveis.
2. Fazer OCR e extrair nome, CPF, data de nascimento e número do documento.
3. Conferir se o CPF extraído bate com o CPF da sessão.
4. Guardar a imagem criptografada, associada à sessão, com data de descarte.

Resposta `200`:

```json
{ "ok": true }
```

ou

```json
{ "ok": false, "motivo": "Não conseguimos ler o documento. Evite reflexos e tente de novo." }
```

`motivo` é mostrado ao usuário como está, então escreva para ele.

## 3. Enviar selfie

`POST /identity/sessions/{sessaoId}/selfie` — `multipart/form-data`

| campo    | tipo    |
|----------|---------|
| `imagem` | arquivo JPEG |

O backend deve:

1. Detectar exatamente um rosto, com qualidade mínima.
2. Comparar com a foto do documento (frente) da mesma sessão. Definir um limiar de similaridade e registrar o score.
3. Prova de vida (ver seção abaixo).

Resposta `200`: mesmo formato de `ok` / `motivo`.

## 4. Concluir

`POST /identity/sessions/{sessaoId}/finish`

```json
{ "tipo": "cnh" }
```

Resposta `200` (formato `VerificacaoIdentidade` em `src/services/types.ts`):

```json
{
  "provedor": "proprio",
  "sessaoId": "sess_8f3a2c",
  "documentoTipo": "cnh",
  "documentoOk": true,
  "provaDeVidaOk": true
}
```

Esse objeto vai dentro de `abrirConta` como `identidade`. O backend de cadastro deve recusar a
abertura se `documentoOk` ou `provaDeVidaOk` forem `false`, ou se a sessão não existir.

## Prova de vida

É a parte difícil: distinguir uma pessoa real de foto impressa, tela de celular, máscara ou vídeo.
Uma única selfie não resolve isso. Opções, da mais simples para a mais robusta:

1. **Passiva por modelo**: um modelo anti-spoofing analisa a própria selfie (textura, reflexos,
   moiré). Há modelos abertos (ex.: MiniFASNet / Silent-Face-Anti-Spoofing) com acurácia limitada.
2. **Ativa com desafio**: o app grava alguns segundos enquanto o backend pede ações aleatórias
   (virar a cabeça, piscar). Exige o backend emitindo o desafio e validando o vídeo com detecção de
   marcos faciais. Só faz sentido com o backend pronto; sem ele, a tela não verifica nada.
3. **Provedor homologado só para a prova de vida**, mantendo OCR e comparação facial próprios.

Recomendação: começar com a opção 1 no backend, registrar os scores, e decidir entre 2 e 3 com base
no que a instituição emissora exigir. A interface `IdentityProvider` não muda em nenhum dos casos.

## Bibliotecas abertas para o backend (Python)

- OCR: PaddleOCR ou Tesseract (com pré-processamento via OpenCV).
- Detecção e comparação facial: InsightFace (ArcFace) ou DeepFace.
- Anti-spoofing passivo: Silent-Face-Anti-Spoofing (MiniFASNet).

## LGPD

Biometria facial e documento são dados pessoais sensíveis.

- Consentimento específico e destacado na tela de cadastro (já existe o aceite; o texto deve citar
  a finalidade: confirmar identidade para abertura de conta).
- Armazenar criptografado, com acesso restrito e registro de acessos.
- Prazo de retenção definido (ex.: descartar as imagens após a conclusão, guardar apenas o
  resultado e os scores, ou o prazo que a instituição emissora exigir).
- Canal para o titular pedir exclusão.
