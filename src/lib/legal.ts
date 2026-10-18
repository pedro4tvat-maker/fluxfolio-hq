// Termos de Uso e Política de Privacidade do SISTEMAFP PJ.
// Ao alterar o texto, suba a versão: o cadastro registra a versão aceita por cada usuário.

export const LEGAL_VERSAO = "1.0";
export const LEGAL_VIGENCIA = "18/10/2026";

export const EMPRESA = {
  nome: "Pedro Guilherme Pereira Santana (Finanças em Propósito)",
  cnpj: "60.799.295/0001-30",
  cidade: "Vitória da Conquista/BA",
  emailPrivacidade: "sistemafp@outlook.com",
  site: "sistemafp.com.br",
};

export type Secao = { titulo: string; paragrafos?: string[]; itens?: string[] };

export const TERMOS: Secao[] = [
  {
    titulo: "1. Quem somos e o que é o SISTEMAFP PJ",
    paragrafos: [
      `O SISTEMAFP PJ é uma plataforma on-line de gestão financeira para pequenas e médias empresas, oferecida por ${EMPRESA.nome}, CNPJ ${EMPRESA.cnpj}, com sede em ${EMPRESA.cidade} ("SISTEMAFP", "nós").`,
      "Estes Termos de Uso regulam o acesso e o uso da plataforma em " + EMPRESA.site + ". Ao criar uma conta ou usar o sistema, você declara que leu, entendeu e concorda com estes Termos e com a Política de Privacidade.",
    ],
  },
  {
    titulo: "2. Quem pode usar",
    itens: [
      "Pessoas com 18 anos ou mais, que usem o sistema em nome próprio ou de uma empresa da qual tenham poderes para agir.",
      "Empresários, seus colaboradores autorizados e consultores financeiros vinculados a uma empresa com autorização dela.",
      "Você é responsável pela veracidade dos dados informados no cadastro e por mantê-los atualizados.",
    ],
  },
  {
    titulo: "3. Conta, login e senha",
    itens: [
      "O acesso é pessoal e intransferível. Não compartilhe sua senha.",
      "Você é responsável por todas as ações feitas com o seu login. Se suspeitar de uso indevido, troque a senha e avise-nos imediatamente.",
      "Podemos exigir regras mínimas de senha e confirmação de e-mail para proteger as contas.",
    ],
  },
  {
    titulo: "4. Empresas, colaboradores e consultores",
    itens: [
      "Cada empresa cadastrada é administrada pelo seu responsável, que decide quem tem acesso aos dados dela.",
      "O consultor só acessa os dados de uma empresa depois que o vínculo é solicitado e aprovado. A empresa pode encerrar o vínculo a qualquer momento.",
      "O consultor deve usar os dados das empresas apenas para prestar o serviço contratado por elas, mantendo sigilo.",
    ],
  },
  {
    titulo: "5. Uso permitido",
    paragrafos: ["Você se compromete a usar o sistema de forma lícita. É proibido, entre outras condutas:"],
    itens: [
      "inserir dados de terceiros sem ter base legal ou autorização para isso;",
      "tentar acessar dados de outras empresas ou contas, explorar falhas ou burlar mecanismos de segurança;",
      "usar o sistema para fraude, lavagem de dinheiro ou qualquer atividade ilegal;",
      "copiar, revender ou fazer engenharia reversa da plataforma.",
    ],
  },
  {
    titulo: "6. Planos, pagamento e cancelamento",
    itens: [
      "O uso do sistema é cobrado por mensalidade, conforme o plano e o valor informados na contratação. A implantação e o acompanhamento de consultoria, quando contratados, são cobrados à parte.",
      "A falta de pagamento pode levar à suspensão do acesso, após aviso.",
      "Você pode cancelar a qualquer momento, sem multa, com efeito ao fim do período já pago, salvo condição diferente combinada por escrito.",
      "Após o cancelamento, você pode pedir uma cópia dos dados da sua empresa em até 30 dias. Depois desse prazo, os dados são excluídos conforme a Política de Privacidade.",
    ],
  },
  {
    titulo: "7. Relatórios, análises e inteligência artificial",
    itens: [
      "Os relatórios, indicadores e análises (inclusive os gerados por inteligência artificial) são calculados a partir dos dados lançados por você. A qualidade do resultado depende da qualidade dos lançamentos.",
      "As análises são um apoio à gestão e não substituem a contabilidade, a assessoria jurídica ou tributária, nem garantem resultados financeiros. As decisões tomadas com base nelas são de responsabilidade da empresa.",
      "O sistema não emite notas fiscais nem substitui as obrigações contábeis e fiscais da empresa.",
    ],
  },
  {
    titulo: "8. Disponibilidade e responsabilidade",
    itens: [
      "Trabalhamos para manter o sistema disponível e seguro, com cópias de segurança diárias, mas podem ocorrer interrupções para manutenção ou por falhas de terceiros (internet, provedores de hospedagem).",
      "Não nos responsabilizamos por perdas decorrentes de dados lançados incorretamente, de uso indevido do login pelo próprio usuário ou de fatores fora do nosso controle razoável.",
      "Nossa responsabilidade, quando existir, fica limitada ao valor pago pela empresa nos 12 meses anteriores ao fato, salvo nos casos em que a lei não permite essa limitação.",
    ],
  },
  {
    titulo: "9. Propriedade intelectual",
    paragrafos: [
      "A plataforma, a marca SISTEMAFP PJ, os layouts e os códigos pertencem ao SISTEMAFP. Os dados que você lança continuam sendo seus (ou da sua empresa), e você nos autoriza a tratá-los apenas para prestar o serviço, conforme a Política de Privacidade.",
    ],
  },
  {
    titulo: "10. Suspensão de acesso",
    paragrafos: [
      "Podemos suspender ou encerrar contas que violem estes Termos ou a lei, ou que coloquem em risco a segurança do sistema e dos demais usuários, sempre que possível com aviso prévio.",
    ],
  },
  {
    titulo: "11. Alterações destes Termos",
    paragrafos: [
      "Podemos atualizar estes Termos. Mudanças relevantes serão comunicadas no sistema ou por e-mail, e a versão vigente fica sempre disponível nesta página.",
    ],
  },
  {
    titulo: "12. Lei e foro",
    paragrafos: [
      `Estes Termos seguem a legislação brasileira, incluindo o Código de Defesa do Consumidor quando aplicável e a Lei Geral de Proteção de Dados (Lei 13.709/2018). Fica eleito o foro da comarca de ${EMPRESA.cidade}, ressalvado o direito do consumidor de propor ação no seu domicílio.`,
      `Dúvidas: ${EMPRESA.emailPrivacidade}.`,
    ],
  },
];

export const PRIVACIDADE: Secao[] = [
  {
    titulo: "1. Resumo",
    paragrafos: [
      "Usamos os seus dados para fazer o sistema funcionar: criar sua conta, guardar os lançamentos da sua empresa, gerar relatórios e permitir o acompanhamento do consultor que você autorizar. Não vendemos dados e não os usamos para publicidade.",
    ],
  },
  {
    titulo: "2. Quem é responsável pelos dados",
    itens: [
      `Pelos dados de cadastro dos usuários (nome, e-mail, telefone, login), o controlador é ${EMPRESA.nome}, CNPJ ${EMPRESA.cnpj}.`,
      "Pelos dados que cada empresa lança no sistema sobre os próprios clientes, fornecedores e colaboradores (por exemplo, nomes em vendas, contas a receber ou no CRM), a controladora é a própria empresa. Nesses casos, o SISTEMAFP atua como operador: trata os dados apenas para prestar o serviço, conforme as instruções da empresa.",
      `Contato para assuntos de privacidade (encarregado): ${EMPRESA.emailPrivacidade}.`,
    ],
  },
  {
    titulo: "3. Quais dados tratamos",
    itens: [
      "Cadastro: nome, e-mail, telefone, senha (guardada de forma criptografada, que nem nós conseguimos ler) e o perfil de acesso.",
      "Dados da empresa: razão social, CNPJ ou CPF, endereço, segmento e contatos.",
      "Dados de gestão lançados pela empresa: movimentações financeiras, contas a pagar e a receber, vendas, produtos, estoque, orçamentos, atas de reunião, documentos e arquivos anexados.",
      "Dados de uso e segurança: registros de acesso e de alterações (data, hora, usuário e ação), mantidos para segurança e auditoria.",
    ],
  },
  {
    titulo: "4. Para que usamos e com qual base legal",
    itens: [
      "Prestar o serviço contratado: cadastro, login, guarda dos lançamentos, relatórios e análises (execução de contrato).",
      "Permitir o acompanhamento do consultor vinculado à empresa, quando autorizado (execução de contrato e instruções da empresa).",
      "Enviar e-mails do sistema, como confirmação de cadastro e recuperação de senha (execução de contrato).",
      "Manter a segurança, prevenir fraudes e registrar acessos (legítimo interesse e cumprimento de obrigação legal, como o Marco Civil da Internet).",
      "Cumprir obrigações legais e regulatórias e exercer direitos em processos (obrigação legal e exercício regular de direitos).",
    ],
  },
  {
    titulo: "5. Com quem compartilhamos",
    paragrafos: ["Compartilhamos dados apenas com fornecedores necessários para o sistema funcionar, que seguem padrões de segurança adequados:"],
    itens: [
      "Supabase: banco de dados e arquivos, em servidores localizados no Brasil (São Paulo).",
      "Cloudflare: hospedagem e entrega do site.",
      "Anthropic (Claude): geração das análises e atas com inteligência artificial. São enviados apenas os dados necessários para cada análise (indicadores do período, nomes de produtos ou o relato da reunião), sem senhas. Conforme as condições comerciais da Anthropic, os dados enviados pela API não são usados para treinar os modelos dela.",
      "Resend: envio dos e-mails do sistema.",
      "GitHub: guarda das cópias de segurança, em repositório privado.",
      "Autoridades públicas, quando houver obrigação legal ou ordem judicial.",
    ],
  },
  {
    titulo: "6. Transferência internacional",
    paragrafos: [
      "Alguns fornecedores (Cloudflare, Anthropic, Resend e GitHub) podem tratar dados fora do Brasil, principalmente nos Estados Unidos. Essas transferências são feitas para a execução do contrato com você e com fornecedores que adotam garantias contratuais e de segurança compatíveis com a LGPD.",
    ],
  },
  {
    titulo: "7. Por quanto tempo guardamos",
    itens: [
      "Enquanto a conta ou a empresa estiver ativa no sistema.",
      "Após o cancelamento, a empresa pode pedir uma cópia dos dados em até 30 dias. Depois disso, os dados são excluídos ou anonimizados, salvo o que precisarmos guardar por obrigação legal (por exemplo, registros de acesso por 6 meses e documentos fiscais pelo prazo da lei).",
      "As cópias de segurança automáticas são substituídas a cada 30 dias.",
    ],
  },
  {
    titulo: "8. Como protegemos",
    itens: [
      "Conexão sempre criptografada (HTTPS).",
      "Separação dos dados por empresa no próprio banco de dados: cada usuário só acessa as empresas às quais tem permissão.",
      "Senhas guardadas com criptografia e regras mínimas de senha.",
      "Registro de alterações (auditoria) e cópias de segurança diárias.",
      "Acesso administrativo restrito e com credenciais protegidas.",
    ],
  },
  {
    titulo: "9. Seus direitos",
    paragrafos: [`Você pode, a qualquer momento, pelo e-mail ${EMPRESA.emailPrivacidade}:`],
    itens: [
      "confirmar se tratamos seus dados e pedir acesso a eles;",
      "corrigir dados incompletos, inexatos ou desatualizados;",
      "pedir anonimização, bloqueio ou exclusão de dados desnecessários ou tratados em desconformidade com a lei;",
      "pedir a portabilidade dos dados;",
      "saber com quem compartilhamos seus dados;",
      "revogar consentimentos, quando o tratamento depender deles;",
      "reclamar à Autoridade Nacional de Proteção de Dados (ANPD).",
    ],
  },
  {
    titulo: "10. Pedidos sobre dados lançados por uma empresa",
    paragrafos: [
      "Se você é cliente, fornecedor ou colaborador de uma empresa que usa o SISTEMAFP PJ e quer exercer seus direitos sobre dados lançados por ela, o pedido deve ser feito diretamente à empresa, que é a controladora. Se você nos contatar, encaminharemos o pedido à empresa responsável.",
    ],
  },
  {
    titulo: "11. Cookies e armazenamento no navegador",
    paragrafos: [
      "Usamos apenas o armazenamento necessário para manter você conectado e lembrar preferências do sistema. Não usamos cookies de publicidade nem de rastreamento de terceiros.",
    ],
  },
  {
    titulo: "12. Incidentes de segurança",
    paragrafos: [
      "Se ocorrer um incidente de segurança que possa trazer risco ou dano relevante, avisaremos as empresas e os usuários afetados e a ANPD, nos termos da lei, com as medidas adotadas.",
    ],
  },
  {
    titulo: "13. Alterações desta Política",
    paragrafos: [
      "Esta Política pode ser atualizada. Mudanças relevantes serão comunicadas no sistema ou por e-mail, e a versão vigente fica sempre disponível nesta página.",
    ],
  },
];
