# Anti-Patterns — Release Notes

## 1. Anúncio corporativo genérico
**Errado:** "Estamos muito animados para anunciar mais uma release cheia de novidades incríveis!"
**Por quê:** zero substância, palavra-chave de marketês, viola tom documentado.
**Certo:** ir direto ao que mudou.

## 2. Mistura de níveis de abstração
**Errado (em anúncio stakeholder):** "Corrigimos o retry lógico no consumer NATS do módulo de dispensação."
**Por quê:** detalhe de implementação não interessa ao gestor; confunde mais do que informa.
**Certo:** "Corrigimos duplicação ocasional de ordens de dispensação sob carga alta."

## 3. Tradução de nomes próprios
**Errado:** "Usamos o Temporal (Temporario) para orquestrar..."
**Certo:** "Usamos o Temporal para orquestrar..." — nomes de produtos/libs ficam em inglês.

## 4. Superlativo sem evidência
**Errado:** "Melhoria significativa de performance no scheduler."
**Por quê:** "significativa" sem número é vazio.
**Certo:** "Latência p95 do scheduler caiu de 800ms para 250ms em staging."  
Ou, se não há número: "Refactor do scheduler — sem mudança de comportamento observável."

## 5. Breaking change sem instrução
**Errado:** "feat(api)!: nova versão da API de pacientes."
**Por quê:** `!` indica breaking mas não diz o que quebrou nem como migrar.
**Certo:** incluir seção explícita "Migração" com os passos, mesmo que seja "Nenhuma ação necessária" quando aplicável.

## 6. Agregação silenciosa
**Errado:** "Várias melhorias internas."
**Por quê:** esconde a ausência de substância ou o fato de que o redator não leu os commits.
**Certo:** listar os commits na seção "Interno" ou omitir a seção se vazia.

## 7. PHI em exemplo
**Errado:** "Corrigimos bug que afetava o paciente João Silva (MRN 123456)."
**Por quê:** CRÍTICO — vazamento de PHI, mesmo em exemplo de bug.
**Certo:** "Corrigimos bug em cálculo de dose que podia afetar pacientes com idade < 12 anos."

## 8. Changelog com hash em anúncio stakeholder
**Errado:** "Corrigimos (`abc1234`) o problema de..."
**Por quê:** hash de commit é artefato técnico, não pertence ao texto de gestor.
**Certo:** hash fica no changelog técnico apenas.

## 9. Commits ignorados sem justificativa
**Errado:** pular commits do brief sem mencionar em "Cobertura".
**Certo:** na seção "Cobertura" do changelog, listar commits ignorados com a razão (ex: "Revert parcial já compensado por commit posterior").

## 10. Emoji decorativo em changelog
**Errado:** "## ✨ Features ✨"
**Por quê:** viola tom documentado em company.md (zero emojis corporativos).
**Certo:** "## Features". Exceção: se o commit original usar emoji na mensagem, preservar por respeito ao autor.
