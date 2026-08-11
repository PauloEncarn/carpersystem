-- Padroniza o código oficial do RG da linha de salgadinho.
update public.rgs
set codigo = 'RG.QUA.004',
    titulo = 'Controle de Liberacao de Produto - Salgadinho'
where codigo = 'RG.QUA.BA.004';
