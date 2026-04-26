import { useMemo, useState } from 'react';
import { CircleDollarSign, Percent, Wallet } from 'lucide-react';
import { Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts';
import { MetricCard } from '../components/MetricCard';
import { Section } from '../components/Section';
import { formatarMoeda } from '../utils/formatadores';
import { ChartFrame } from '../components/ChartFrame';

type Produto = 'CDB' | 'Tesouro Selic' | 'Tesouro IPCA+' | 'LCI/LCA' | 'Fundos Imobiliarios' | 'Acoes' | 'Cripto' | 'Generico';
type TipoRentabilidade = '% do CDI' | 'CDI + taxa' | 'IPCA + taxa' | 'Prefixado ao ano';

const produtos: Produto[] = ['CDB', 'Tesouro Selic', 'Tesouro IPCA+', 'LCI/LCA', 'Fundos Imobiliarios', 'Acoes', 'Cripto', 'Generico'];

export function Simulador() {
  const [produto, setProduto] = useState<Produto>('CDB');
  const [valorInicial, setValorInicial] = useState(10000);
  const [aporteMensal, setAporteMensal] = useState(1000);
  const [prazoMeses, setPrazoMeses] = useState(36);
  const [tipoRentabilidade, setTipoRentabilidade] = useState<TipoRentabilidade>('% do CDI');
  const [taxa, setTaxa] = useState(105);
  const [cdi, setCdi] = useState(10.65);
  const [ipca, setIpca] = useState(4.2);
  const isento = produto === 'LCI/LCA';
  const resultado = useMemo(() => simular({ valorInicial, aporteMensal, prazoMeses, tipoRentabilidade, taxa, cdi, ipca, isento, produto }), [valorInicial, aporteMensal, prazoMeses, tipoRentabilidade, taxa, cdi, ipca, isento, produto]);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {produtos.map((item) => <button key={item} className={item === produto ? 'btn-primary' : 'btn-secondary'} onClick={() => setProduto(item)}>{item}</button>)}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard titulo="Resultado bruto" valor={formatarMoeda(resultado.bruto)} variacao={`${prazoMeses} meses simulados`} icon={Wallet} />
        <MetricCard titulo="Resultado liquido" valor={formatarMoeda(resultado.liquido)} variacao={isento ? 'Isento de IR' : `IR: ${resultado.aliquotaIr}%`} icon={CircleDollarSign} tom="verde" />
        <MetricCard titulo="Total investido" valor={formatarMoeda(resultado.investido)} variacao="Inicial + aportes" icon={CircleDollarSign} tom="azul" />
        <MetricCard titulo="Juros liquidos" valor={formatarMoeda(resultado.jurosLiquidos)} variacao="Depois de impostos" icon={Percent} tom="ambar" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <Section titulo="Parametros">
          <div className="space-y-4">
            <label className="block text-sm font-semibold">Valor inicial<input className="input mt-1" type="number" value={valorInicial} onChange={(e) => setValorInicial(Number(e.target.value))} /></label>
            <label className="block text-sm font-semibold">Aporte mensal<input className="input mt-1" type="number" value={aporteMensal} onChange={(e) => setAporteMensal(Number(e.target.value))} /></label>
            <label className="block text-sm font-semibold">Prazo em meses<input className="input mt-1" type="number" value={prazoMeses} onChange={(e) => setPrazoMeses(Number(e.target.value))} /></label>
            <label className="block text-sm font-semibold">Tipo de rentabilidade<select className="input mt-1" value={tipoRentabilidade} onChange={(e) => setTipoRentabilidade(e.target.value as TipoRentabilidade)}><option>% do CDI</option><option>CDI + taxa</option><option>IPCA + taxa</option><option>Prefixado ao ano</option></select></label>
            <label className="block text-sm font-semibold">Taxa<input className="input mt-1" type="number" step="0.01" value={taxa} onChange={(e) => setTaxa(Number(e.target.value))} /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm font-semibold">CDI ano<input className="input mt-1" type="number" step="0.01" value={cdi} onChange={(e) => setCdi(Number(e.target.value))} /></label>
              <label className="block text-sm font-semibold">IPCA ano<input className="input mt-1" type="number" step="0.01" value={ipca} onChange={(e) => setIpca(Number(e.target.value))} /></label>
            </div>
          </div>
        </Section>

        <Section titulo="Evolucao mes a mes">
          <ChartFrame className="h-[360px]">
            <LineChart data={resultado.serie}>
              <XAxis dataKey="mes" /><YAxis tickFormatter={(v) => `${Number(v) / 1000}k`} /><Tooltip formatter={(v) => formatarMoeda(Number(v))} />
              <Line dataKey="bruto" stroke="#7C3AED" strokeWidth={3} dot={false} />
              <Line dataKey="investido" stroke="#A78BFA" strokeWidth={2} dot={false} />
              <Line dataKey="liquido" stroke="#10B981" strokeWidth={2} dot={false} />
            </LineChart>
          </ChartFrame>
        </Section>
      </div>
    </div>
  );
}

function simular(params: { valorInicial: number; aporteMensal: number; prazoMeses: number; tipoRentabilidade: TipoRentabilidade; taxa: number; cdi: number; ipca: number; isento: boolean; produto: Produto }) {
  const taxaAnual = taxaAnualProduto(params);
  const taxaMensal = Math.pow(1 + taxaAnual / 100, 1 / 12) - 1;
  let bruto = params.valorInicial;
  const serie = Array.from({ length: params.prazoMeses + 1 }, (_, mes) => {
    if (mes > 0) bruto = bruto * (1 + taxaMensal) + params.aporteMensal;
    const investido = params.valorInicial + params.aporteMensal * mes;
    const juros = Math.max(bruto - investido, 0);
    const aliquota = params.isento ? 0 : aliquotaIr(mes);
    const liquido = bruto - juros * aliquota;
    return { mes, bruto: Math.round(bruto), investido, liquido: Math.round(liquido) };
  });
  const ultimo = serie[serie.length - 1];
  const jurosBrutos = Math.max(ultimo.bruto - ultimo.investido, 0);
  const aliquota = params.isento ? 0 : aliquotaIr(params.prazoMeses);
  const liquido = ultimo.bruto - jurosBrutos * aliquota;
  return { serie, bruto: ultimo.bruto, liquido, investido: ultimo.investido, jurosLiquidos: liquido - ultimo.investido, aliquotaIr: aliquota * 100 };
}

function taxaAnualProduto(params: { tipoRentabilidade: TipoRentabilidade; taxa: number; cdi: number; ipca: number; produto: Produto }) {
  if (params.produto === 'Fundos Imobiliarios') return 9;
  if (params.produto === 'Acoes') return 11;
  if (params.produto === 'Cripto') return 16;
  if (params.tipoRentabilidade === '% do CDI') return params.cdi * (params.taxa / 100);
  if (params.tipoRentabilidade === 'CDI + taxa') return params.cdi + params.taxa;
  if (params.tipoRentabilidade === 'IPCA + taxa') return params.ipca + params.taxa;
  return params.taxa;
}

function aliquotaIr(meses: number) {
  const dias = meses * 30;
  if (dias <= 180) return 0.225;
  if (dias <= 360) return 0.2;
  if (dias <= 720) return 0.175;
  return 0.15;
}
