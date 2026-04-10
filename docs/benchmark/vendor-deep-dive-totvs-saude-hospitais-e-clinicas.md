# Deep Dive — TOTVS Saúde Hospitais e Clínicas

## Identificação

- **Fornecedor:** TOTVS S.A. (maior empresa brasileira de software corporativo)
- **Produto:** TOTVS Saúde Hospitais e Clínicas — linha RM 12.1 (com módulos verticalizados para saúde)
- **Escala:** Centenas de hospitais e milhares de clínicas no Brasil
- **Origem:** Sistema RM (Recursos Materiais) verticalizado para saúde, expandido ao longo dos anos
- **Arquitetura:** ERP tradicional TOTVS com módulos específicos de saúde; stack .NET + SQL Server
- **Modelo comercial:** Licenciamento + SaaS + cloud TOTVS Cloud

## Posicionamento

A TOTVS posiciona sua oferta de saúde como uma **extensão verticalizada do maior ERP brasileiro**, aproveitando o domínio absoluto da TOTVS em gestão empresarial no Brasil. O argumento de venda é: "você já roda TOTVS RM no financeiro e RH da sua empresa/rede hospitalar; agora pode unificar tudo com a vertical de saúde".

A mensagem principal é **"jornada digital 100%"**: da recepção do paciente até a alta, todo o fluxo acontece em uma única plataforma. A TOTVS enfatiza a **integração nativa com WhatsApp**, **teleconsulta** e **portal do paciente** como diferenciais frente aos concorrentes tradicionais (Tasy, MV) — um argumento de "mais moderno, mais digital, mais conectado".

## Escopo Funcional Documentado

### Clínico
- **PEP** integrado
- **Prescrição eletrônica**
- **Protocolos clínicos**
- **Evolução multiprofissional**
- **Teleconsulta nativa**

### Operacional
- **Agendamento** multi-recurso
- **Gestão de leitos**
- **Centro cirúrgico**
- **Pronto atendimento**
- **Farmácia hospitalar**
- **Ambulatório**

### Administrativo / Financeiro
- **Faturamento hospitalar** (convênio, particular, SUS)
- **TISS/TUSS**
- **Contas a pagar / receber**
- **Contabilidade integrada ao RM**
- **Custos hospitalares**
- **RH** integrado (escala, folha, ponto)

### Experiência do Paciente
- **Portal do paciente** — agendamento, resultados, histórico, pagamento
- **Integração WhatsApp** — agendamentos, confirmações, lembretes, resultados
- **Teleconsulta** nativa — vídeo, chat, documentos
- **App do paciente**

### Gestão e BI
- **Dashboards** executivos
- **Indicadores assistenciais e financeiros**
- **Integração com TOTVS Analytics**

## Diferenciais Evidentes

1. **Jornada 100% digital** — mensagem comercial clara e estruturada (recepção → alta)
2. **Integração WhatsApp nativa** — único fornecedor que faz disso um diferencial público
3. **Teleconsulta nativa** — não é add-on; é parte do produto
4. **Portal do paciente** maduro e integrado
5. **Ecossistema TOTVS** — quem já usa RM, Protheus, Datasul tem integração natural
6. **Cloud TOTVS** — oferta SaaS estabelecida

## Forças

- **Escala da TOTVS** — rede comercial, suporte nacional, estabilidade financeira
- **Integração com o ERP corporativo TOTVS** — argumento forte para redes hospitalares
- **WhatsApp + Teleconsulta** — mensagens de marketing diretas e modernas
- **Presença em hospitais e clínicas** — cobertura dupla
- **Preço** tipicamente mais acessível que Tasy e MV para médio porte

## Limitações Evidentes

1. **Origem ERP** — profundidade clínica menor que Tasy, MV e Pixeon; a ancestralidade é financeira, não clínica
2. **KLAS recognition** — não tem o mesmo destaque clínico que MV (PEP melhor LatAm 6 anos)
3. **Stack legado** — .NET + SQL Server; não é cloud-native
4. **Dependência do ecossistema TOTVS** — integração com fornecedores fora da TOTVS é menos fluida
5. **Alertas de interação medicamentosa** e CDS são menos maduros que MV/Tasy
6. **UI/UX** tem sabor "ERP corporativo" — menos otimizada para fluxo clínico beira-leito
7. **Observabilidade** e **auditoria radical** não são diferenciais
8. **IA governada** — comunicação pública limitada
9. **Patient Journey** — mensagem existe, mas sem entregar timeline unificada

## O Que Inspira o Velya

### Copiar
- **Mensagem "jornada digital 100%"** — Velya adota e entrega de forma literal (com timeline unificada)
- **Integração WhatsApp nativa** — Velya trata WhatsApp como canal de primeira classe
- **Teleconsulta nativa** — parte do produto, não add-on
- **Portal do paciente maduro** — agendamento, resultados, pagamento, histórico
- **Agenda do paciente visível no app** — experiência completa

### Adaptar
- **Integração com ERP** — Velya não tenta ser ERP; integra com os ERPs existentes via APIs
- **Dashboards executivos** — Velya adapta como observabilidade + BI, com dados em tempo real e contratos claros
- **Cloud SaaS** — Velya é cloud-native real, não hosting de legado

### Superar
- **Profundidade clínica** — Velya precisa superar TOTVS em PEP, prescrição, alertas, avaliações
- **KLAS recognition** — Velya deve perseguir reconhecimento independente
- **Cloud-native real** vs hosting de legado
- **Auditoria radical** — hash chain, proveniência
- **Observabilidade OTel nativa**
- **Mobile-first** — app profissional nativo offline-first, não web responsivo
- **Patient Journey unificada** — a promessa da TOTVS entregue de fato
- **IA governada** — kill switch, evaluation harness

### Rejeitar
- **Dependência de ecossistema proprietário** — Velya é aberto, integra com qualquer ERP/HR/BI
- **UI "ERP corporativo"** — Velya tem UX clínica desenhada para o leito, não para o escritório

## Conclusão

TOTVS Saúde Hospitais e Clínicas é o **benchmark de mensagem digital/jornada/WhatsApp** no mercado brasileiro. Sua força está mais na comunicação e na integração com o ecossistema TOTVS do que na profundidade clínica.

Para o Velya, a lição mais importante da TOTVS é **comunicacional**: o mercado brasileiro responde muito bem a mensagens como "jornada 100% digital", "WhatsApp nativo", "teleconsulta embarcada", "portal do paciente moderno". Velya deve comunicar nesses termos, **e entregar de verdade o que a TOTVS comunica mas entrega de forma rasa**.

Um cliente que avalia TOTVS e Velya está tipicamente num hospital ou rede de médio porte, onde o argumento de venda é modernidade, digitalização e experiência do paciente. Velya vence esse cliente mostrando:

1. A mesma modernidade comunicada pela TOTVS
2. Profundidade clínica comparável a MV/Tasy
3. Arquitetura cloud-native real
4. Mobile-first profissional (não só para paciente)
5. Patient Journey unificada de verdade
6. Auditoria, observabilidade e governança de IA que nenhum concorrente tem
