# Prompt de apresentação - Águia 5.0

> Copie tudo a partir da linha abaixo e cole em outra IA (ChatGPT, Gemini, Gamma, Tome, etc.) para gerar os slides.

---

Crie uma apresentação profissional (formato slides, estilo institucional/corporativo) sobre o sistema descrito abaixo. Use entre 12 e 16 slides, tom direto e objetivo, poucas palavras por slide (bullets curtos, não parágrafos), e sugira um slide de capa, um de agenda/sumário e um de encerramento com contato. Destaque números e benefícios concretos sempre que possível.

## Sobre o sistema

**Nome:** Águia 5.0 - Sistema Cartorial
**O que é:** sistema de gestão de produtividade e controle de protocolos para cartórios de registro de imóveis, desenvolvido sob medida para o fluxo de trabalho de um cartório (atualmente em uso no Cartório 1º Ofício de Imóveis de Manaus).

**Problema que resolve:** cartórios lidam com grande volume de protocolos (prazos legais, múltiplos setores, múltiplos responsáveis) e historicamente isso é controlado em planilhas ou sistemas genéricos que não avisam sobre prazos vencendo, não mostram produtividade por funcionário e não têm rastreabilidade de quem fez o quê e quando.

**Proposta de valor:**
- Visibilidade total do status de cada protocolo, em tempo real.
- Cálculo automático de prazos (dias úteis ou corridos, com feriados cadastrados).
- Alertas automáticos de protocolos vencendo ou atrasados.
- Histórico/auditoria completo de cada ação em cada protocolo (quem fez, quando, o quê).
- Métricas de produtividade por funcionário e por tipo de serviço.
- Permissões por cargo, aplicadas tanto na tela quanto no backend (não é só esconder botão).

## Perfis de usuário e o que cada um vê

- **Registrador**: cadastra e conduz protocolos, acompanha sua fila e sua própria produtividade.
- **Coordenador**: supervisiona a operação, acessa relatórios e os mesmos módulos do Supervisor exceto administração de usuários.
- **Supervisor**: acesso total - gestão de funcionários, configurações, relatórios gerenciais.
- **Atendente**: trabalha no balcão de atendimento ao público e na devolução de protocolos enviados pelos registradores.

## Módulos do sistema

1. **Dashboard** - métricas em tempo real: total de protocolos, concluídos, atrasados, vencendo.
2. **Protocolos** - cadastro, atribuição a funcionários, cálculo automático de prazo, conclusão, transferência entre setores.
3. **Fila de Atendimento** - fila organizada de protocolos aguardando ação do registrador.
4. **Enviar para Atendimento / Devolução** - fluxo específico: ao concluir um protocolo, o registrador pode enviá-lo ao setor de Atendimento (como Orçamento ou Nota Devolutiva, com indicador de Protocolo ONR); o Atendimento vê a fila de pendentes, marca como devolvido, e tudo fica registrado no histórico - nada é apagado.
5. **Consulta de localização** - busca rápida que responde "onde está esse protocolo agora, com quem, desde quando".
6. **Tipos de Serviço** - cadastro de serviços com prazo próprio (dias úteis ou corridos).
7. **Usucapião** - módulo dedicado para o fluxo específico de processos de usucapião extrajudicial.
8. **Funcionários** - cadastro de usuários e cargos, controle de acesso.
9. **Histórico** - auditoria completa de ações no sistema.
10. **Minha Produtividade** - cada registrador acompanha seu próprio desempenho.
11. **Relatórios** - produtividade por funcionário, por serviço, protocolos atrasados/vencendo, taxa de sucesso.
12. **Configurações** - feriados, dias não úteis, integrações externas.
13. **Painel** - tela de TV para exibição pública/interna de indicadores do cartório em tempo real.

## Integrações externas (API)

- **API do Painel** - alimenta uma tela de TV interna e também um painel externo que consolida indicadores de vários cartórios para a Corregedoria, de forma anônima.
- **API de Produtividade** - permite que sistemas externos consultem a produtividade de cada registrador (com nome), por período (hoje/semana/mês/ano ou intervalo customizado), autenticada por chave de API.

## Arquitetura técnica

- **Backend:** Node.js + Express, PostgreSQL, autenticação JWT, senhas com bcrypt.
- **Frontend:** React (SPA), React Router.
- **Infraestrutura:** containerizado com Docker (backend, frontend e banco em containers separados), permitindo deploy padronizado em múltiplos cartórios/servidores.
- **Segurança:** controle de permissão por cargo validado no backend (não só escondido na tela), rotas protegidas por token, chave de API para integrações externas.
- **Auditoria:** toda ação relevante (criação, conclusão, transferência, envio para atendimento, devolução) gera um registro de histórico com usuário, data/hora e descrição - nada é excluído, apenas movimentado de status.

## Diferenciais frente a planilha/sistema genérico

- Feito sob medida para o fluxo real de um cartório de imóveis, não adaptado de um sistema genérico de chamados.
- Prazos calculados automaticamente considerando feriados e dias úteis - elimina erro manual.
- Rastreabilidade: para qualquer protocolo, sempre dá para responder "quem fez, quando e o quê".
- Já em uso em produção (não é protótipo).
- Arquitetura em containers permite replicar a instalação para outros cartórios rapidamente.

---

Ao final, gere também um resumo executivo de 3 frases para usar como texto de convite/e-mail de divulgação da apresentação.
