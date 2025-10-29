import { useState } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { estagiariosService } from '../services/firebase';

export default function Formulario() {
  const [loading, setLoading] = useState(false);
  const [cpfError, setCpfError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{[key: string]: string}>({});
  const [formData, setFormData] = useState({
    nome: '',
    nomeSocial: '',
    sexo: '',
    telefone1: '',
    telefone2: '',
    dataNascimento: '',
    email: '',
    cpf: '',
    rg: '',
    orgaoEmissor: '',
    uf: '',
    cidade: '',
    bairro: '',
    endereco: '',
    complemento: '',
    grauInstrucao: '',
    matricula: '',
    horarioDisponivel: [] as string[],
    horarioEstudo: [] as string[],
    ingles: '',
    frances: '',
    espanhol: '',
    informatica: [] as string[],
    aperfeicoamento: [] as string[],
    outrosCursos: '',
    experiencias: [] as Array<{
      empresa: string;
      atribuicoes: string;
      entrada: string;
      saida: string;
    }>
  });

  const applyMask = (value: string, mask: string): string => {
    let result = '';
    let valueIndex = 0;
    
    for (let i = 0; i < mask.length && valueIndex < value.length; i++) {
      if (mask[i] === '#') {
        if (/\d/.test(value[valueIndex])) {
          result += value[valueIndex];
          valueIndex++;
        }
      } else {
        result += mask[i];
        if (value[valueIndex] === mask[i]) {
          valueIndex++;
        }
      }
    }
    
    return result;
  };

  const maskCPF = (value: string): string => {
    const numbers = value.replace(/\D/g, '');
    return applyMask(numbers, '###.###.###-##');
  };

  const validateCPF = (cpf: string): boolean => {
    const cleanCPF = cpf.replace(/\D/g, '');
    
    if (cleanCPF.length !== 11) return false;
    
    if (/^(\d)\1{10}$/.test(cleanCPF)) return false;
    
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cleanCPF.charAt(i)) * (10 - i);
    }
    let remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cleanCPF.charAt(9))) return false;
    
    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cleanCPF.charAt(i)) * (11 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cleanCPF.charAt(10))) return false;
    
    return true;
  };

  const calculateAge = (birthDate: string): number => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return age;
  };

  const validateRequiredFields = (): boolean => {
    const errors: {[key: string]: string} = {};
    
    if (!formData.nome.trim()) {
      errors.nome = 'Nome é obrigatório';
    }
    
    if (!formData.cpf.trim()) {
      errors.cpf = 'CPF é obrigatório';
    } else if (!validateCPF(formData.cpf)) {
      errors.cpf = 'CPF inválido';
    }
    
    if (!formData.sexo) {
      errors.sexo = 'Sexo é obrigatório';
    }
    
    if (!formData.telefone1.trim()) {
      errors.telefone1 = 'Telefone é obrigatório';
    }
    
    if (!formData.endereco.trim()) {
      errors.endereco = 'Endereço é obrigatório';
    }
    
    if (!formData.dataNascimento) {
      errors.dataNascimento = 'Data de nascimento é obrigatória';
    } else {
      const age = calculateAge(formData.dataNascimento);
      if (age < 0) {
        errors.dataNascimento = 'Data de nascimento inválida';
      }
    }
    
    if (!formData.grauInstrucao) {
      errors.grauInstrucao = 'Escolaridade é obrigatória';
    }
    
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const maskPhone = (value: string): string => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 10) {
      return applyMask(numbers, '(##) ####-####');
    } else {
      return applyMask(numbers, '(##) #####-####');
    }
  };

  const handleInputChange = (field: string, value: string | string[]) => {
    let processedValue = value;
    
    if (typeof value === 'string') {
      switch (field) {
        case 'cpf':
          processedValue = maskCPF(value);
          if (processedValue.length === 14) {
            if (validateCPF(processedValue)) {
              setCpfError('');
            } else {
              setCpfError('CPF inválido');
            }
          } else {
            setCpfError('');
          }
          break;
        case 'telefone1':
        case 'telefone2':
          processedValue = maskPhone(value);
          break;
        default:
          processedValue = value;
      }
    }
    
    if (fieldErrors[field]) {
      setFieldErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
    
    setFormData(prev => ({
      ...prev,
      [field]: processedValue
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateRequiredFields()) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }
    
    setLoading(true);
    
    try {
      console.log('Dados a serem enviados:', formData);
      
      await estagiariosService.add({
        nome: formData.nome,
        nomeSocial: formData.nomeSocial,
        sexo: formData.sexo,
        telefone1: formData.telefone1,
        telefone2: formData.telefone2,
        dataNascimento: formData.dataNascimento,
        email: formData.email,
        cpf: formData.cpf,
        rg: formData.rg,
        orgaoEmissor: formData.orgaoEmissor,
        uf: formData.uf,
        cidade: formData.cidade,
        bairro: formData.bairro,
        endereco: formData.endereco,
        complemento: formData.complemento,
        grauInstrucao: formData.grauInstrucao,
        matricula: formData.matricula,
        horarioDisponivel: formData.horarioDisponivel,
        horarioEstudo: formData.horarioEstudo,
        ingles: formData.ingles,
        frances: formData.frances,
        espanhol: formData.espanhol,
        informatica: formData.informatica,
        aperfeicoamento: formData.aperfeicoamento,
        outrosCursos: formData.outrosCursos,
        experiencias: formData.experiencias,
        status: 'ativo'
      });
      
      alert('Cadastro realizado com sucesso!');
      window.location.href = '/estudante';
    } catch (error) {
      console.error('Erro ao enviar cadastro:', error);
      alert('Erro ao enviar cadastro. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <Header currentPage="formulario" />

      <main className="max-w-7xl mx-auto px-4 py-8 sm:py-12 pt-20 sm:pt-24">
        <div className="flex flex-col lg:flex-row gap-4 sm:gap-8">
          <aside className="lg:w-64 lg:flex-shrink-0 order-1">
            <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 lg:sticky lg:top-32">
              <h3 className="text-base sm:text-lg font-bold text-[#004085] mb-3 sm:mb-4 hidden lg:block">Navegação</h3>
              <nav className="lg:space-y-1 lg:space-y-2">
                <div className="lg:hidden mb-3">
                  <h3 className="text-sm font-bold text-[#004085] mb-2">Navegação</h3>
                  <div className="flex flex-wrap gap-2">
                    <a 
                      href="#dados-pessoais" 
                      className="text-xs bg-gray-100 hover:bg-[#004085] hover:text-white text-gray-600 px-2 py-1 rounded transition-colors"
                    >
                      Dados
                    </a>
                    <a 
                      href="#endereco" 
                      className="text-xs bg-gray-100 hover:bg-[#004085] hover:text-white text-gray-600 px-2 py-1 rounded transition-colors"
                    >
                      Endereço
                    </a>
                    <a 
                      href="#escolaridade" 
                      className="text-xs bg-gray-100 hover:bg-[#004085] hover:text-white text-gray-600 px-2 py-1 rounded transition-colors"
                    >
                      Escola
                    </a>
                    <a 
                      href="#cursos" 
                      className="text-xs bg-gray-100 hover:bg-[#004085] hover:text-white text-gray-600 px-2 py-1 rounded transition-colors"
                    >
                      Cursos
                    </a>
                    <a 
                      href="#experiencia" 
                      className="text-xs bg-gray-100 hover:bg-[#004085] hover:text-white text-gray-600 px-2 py-1 rounded transition-colors"
                    >
                      Exp.
                    </a>
                  </div>
                </div>
                <div className="hidden lg:block">
                  <a 
                    href="#dados-pessoais" 
                    className="block text-sm text-gray-600 hover:text-[#004085] hover:font-medium transition-colors py-1"
                  >
                    Dados Pessoais
                  </a>
                  <a 
                    href="#endereco" 
                    className="block text-sm text-gray-600 hover:text-[#004085] hover:font-medium transition-colors py-1"
                  >
                    Endereço
                  </a>
                  <a 
                    href="#escolaridade" 
                    className="block text-sm text-gray-600 hover:text-[#004085] hover:font-medium transition-colors py-1"
                  >
                    Escolaridade
                  </a>
                  <a 
                    href="#cursos" 
                    className="block text-sm text-gray-600 hover:text-[#004085] hover:font-medium transition-colors py-1"
                  >
                    Cursos
                  </a>
                  <a 
                    href="#experiencia" 
                    className="block text-sm text-gray-600 hover:text-[#004085] hover:font-medium transition-colors py-1"
                  >
                    Experiência Profissional
                  </a>
                </div>
              </nav>
            </div>
          </aside>

          <div className="flex-1 order-2 lg:order-2">
            <form onSubmit={handleSubmit}>
                      <div id="dados-pessoais" className="bg-white rounded-lg shadow-lg overflow-hidden">
              <div className="bg-[#004085] text-white px-4 sm:px-6 py-3 sm:py-4">
                <h1 className="text-xl sm:text-2xl font-bold">Dados Pessoais</h1>
              </div>

            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Nome completo"
                  value={formData.nome}
                  onChange={(e) => handleInputChange('nome', e.target.value)}
                  className={`w-full px-3 sm:px-4 py-2 sm:py-3 border rounded-lg focus:ring-2 focus:ring-[#004085] focus:border-transparent text-sm sm:text-base ${
                    fieldErrors.nome ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {fieldErrors.nome && (
                  <p className="text-red-500 text-sm mt-1">{fieldErrors.nome}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome social
                </label>
                <input
                  type="text"
                  placeholder="Nome social"
                  value={formData.nomeSocial}
                  onChange={(e) => handleInputChange('nomeSocial', e.target.value)}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#004085] focus:border-transparent text-sm sm:text-base"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sexo <span className="text-red-500">*</span>
                </label>
                <select 
                  value={formData.sexo}
                  onChange={(e) => handleInputChange('sexo', e.target.value)}
                  className={`w-full px-3 sm:px-4 py-2 sm:py-3 border rounded-lg focus:ring-2 focus:ring-[#004085] focus:border-transparent text-sm sm:text-base bg-white ${
                    fieldErrors.sexo ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">Selecione</option>
                  <option value="masculino">Masculino</option>
                  <option value="feminino">Feminino</option>
                  <option value="outro">Outro</option>
                </select>
                {fieldErrors.sexo && (
                  <p className="text-red-500 text-sm mt-1">{fieldErrors.sexo}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Telefone 1 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    placeholder="(XX)XXXXX-XXXX"
                    value={formData.telefone1}
                    onChange={(e) => handleInputChange('telefone1', e.target.value)}
                    className={`w-full px-3 sm:px-4 py-2 sm:py-3 border rounded-lg focus:ring-2 focus:ring-[#004085] focus:border-transparent text-sm sm:text-base ${
                      fieldErrors.telefone1 ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {fieldErrors.telefone1 && (
                    <p className="text-red-500 text-sm mt-1">{fieldErrors.telefone1}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tipo
                  </label>
                  <select className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#004085] focus:border-transparent text-sm sm:text-base bg-white">
                    <option value="">Selecione</option>
                    <option value="celular">Celular</option>
                    <option value="residencial">Residencial</option>
                    <option value="comercial">Comercial</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Telefone 2
                  </label>
                  <input
                    type="tel"
                    placeholder="(XX)XXXXX-XXXX"
                    value={formData.telefone2}
                    onChange={(e) => handleInputChange('telefone2', e.target.value)}
                    className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#004085] focus:border-transparent text-sm sm:text-base"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tipo
                  </label>
                  <select className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#004085] focus:border-transparent text-sm sm:text-base bg-white">
                    <option value="">Selecione</option>
                    <option value="celular">Celular</option>
                    <option value="residencial">Residencial</option>
                    <option value="comercial">Comercial</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data de Nascimento <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  placeholder="17/08/2025"
                  value={formData.dataNascimento}
                  onChange={(e) => handleInputChange('dataNascimento', e.target.value)}
                  className={`w-full px-3 sm:px-4 py-2 sm:py-3 border rounded-lg focus:ring-2 focus:ring-[#004085] focus:border-transparent text-sm sm:text-base ${
                    fieldErrors.dataNascimento ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {fieldErrors.dataNascimento && (
                  <p className="text-red-500 text-sm mt-1">{fieldErrors.dataNascimento}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  CPF <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="XXX.XXX.XXX-XX"
                  value={formData.cpf}
                  onChange={(e) => handleInputChange('cpf', e.target.value)}
                  className={`w-full px-3 sm:px-4 py-2 sm:py-3 border rounded-lg focus:ring-2 focus:ring-[#004085] focus:border-transparent text-sm sm:text-base ${
                    cpfError || fieldErrors.cpf ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {(cpfError || fieldErrors.cpf) && (
                  <p className="text-red-500 text-sm mt-1">{cpfError || fieldErrors.cpf}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    RG
                  </label>
                  <input
                    type="text"
                    placeholder="Número"
                    value={formData.rg}
                    onChange={(e) => handleInputChange('rg', e.target.value)}
                    className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#004085] focus:border-transparent text-sm sm:text-base"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Órgão emissor
                  </label>
                  <input
                    type="text"
                    placeholder="Órgão emissor"
                    value={formData.orgaoEmissor}
                    onChange={(e) => handleInputChange('orgaoEmissor', e.target.value)}
                    className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#004085] focus:border-transparent text-sm sm:text-base"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    E-mail
                  </label>
                  <input
                    type="email"
                    placeholder="Email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#004085] focus:border-transparent text-sm sm:text-base"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Confirmação de e-mail
                  </label>
                  <input
                    type="email"
                    placeholder="Confirmação do E-mail"
                    className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#004085] focus:border-transparent text-sm sm:text-base"
                  />
                </div>
              </div>


            </div>
          </div>
        </div>

                  <div id="endereco" className="bg-white rounded-lg shadow-lg overflow-hidden mt-6">
            <div className="bg-[#004085] text-white px-4 sm:px-6 py-3 sm:py-4">
              <h2 className="text-xl sm:text-2xl font-bold">Endereço</h2>
            </div>

          <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  UF
                </label>
                <select 
                  value={formData.uf}
                  onChange={(e) => handleInputChange('uf', e.target.value)}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#004085] focus:border-transparent text-sm sm:text-base bg-white"
                >
                  <option value="">UF</option>
                  <option value="DF">DF</option>
                  <option value="GO">GO</option>
                  <option value="MG">MG</option>
                  <option value="SP">SP</option>
                  <option value="RJ">RJ</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cidade
                </label>
                <select 
                  value={formData.cidade}
                  onChange={(e) => handleInputChange('cidade', e.target.value)}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#004085] focus:border-transparent text-sm sm:text-base bg-white"
                >
                  <option value="">Selecione</option>
                  <option value="Brasília">Brasília</option>
                  <option value="Águas Lindas">Águas Lindas</option>
                  <option value="Valparaíso">Valparaíso</option>
                  <option value="Santo Antônio">Santo Antônio</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bairro
                </label>
                <select 
                  value={formData.bairro}
                  onChange={(e) => handleInputChange('bairro', e.target.value)}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#004085] focus:border-transparent text-sm sm:text-base bg-white"
                >
                  <option value="">Selecione</option>
                  <option value="Aeroporto">Aeroporto</option>
                  <option value="Águas Claras">Águas Claras</option>
                  <option value="Arniqueira">Arniqueira</option>
                  <option value="Asa Norte">Asa Norte</option>
                  <option value="Asa Sul">Asa Sul</option>
                  <option value="Brazlândia">Brazlândia</option>
                  <option value="Candangolândia">Candangolândia</option>
                  <option value="Ceilândia">Ceilândia</option>
                  <option value="Cruzeiro">Cruzeiro</option>
                  <option value="Fercal">Fercal</option>
                  <option value="Gama">Gama</option>
                  <option value="Guará">Guará</option>
                  <option value="Itapoã">Itapoã</option>
                  <option value="Jardim Botânico">Jardim Botânico</option>
                  <option value="Lago Norte">Lago Norte</option>
                  <option value="Lago Sul">Lago Sul</option>
                  <option value="Núcleo Bandeirante">Núcleo Bandeirante</option>
                  <option value="Paranoá">Paranoá</option>
                  <option value="Park Way">Park Way</option>
                  <option value="Planaltina">Planaltina</option>
                  <option value="Plano Piloto">Plano Piloto</option>
                  <option value="Recanto das Emas">Recanto das Emas</option>
                  <option value="Riacho Fundo">Riacho Fundo</option>
                  <option value="Riacho Fundo II">Riacho Fundo II</option>
                  <option value="Samambaia">Samambaia</option>
                  <option value="Santa Maria">Santa Maria</option>
                  <option value="São Sebastião">São Sebastião</option>
                  <option value="SCIA">SCIA</option>
                  <option value="SIA">SIA</option>
                  <option value="Sobradinho">Sobradinho</option>
                  <option value="Sobradinho II">Sobradinho II</option>
                  <option value="Sol Nascente">Sol Nascente</option>
                  <option value="Sudoeste">Sudoeste</option>
                  <option value="Taguatinga">Taguatinga</option>
                  <option value="Varjão">Varjão</option>
                  <option value="Vicente Pires">Vicente Pires</option>
                  <option value="Vila Planalto">Vila Planalto</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Endereço <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder=""
                  value={formData.endereco}
                  onChange={(e) => handleInputChange('endereco', e.target.value)}
                  className={`w-full px-3 sm:px-4 py-2 sm:py-3 border rounded-lg focus:ring-2 focus:ring-[#004085] focus:border-transparent text-sm sm:text-base ${
                    fieldErrors.endereco ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {fieldErrors.endereco && (
                  <p className="text-red-500 text-sm mt-1">{fieldErrors.endereco}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Complemento
                </label>
                <input
                  type="text"
                  placeholder=""
                  value={formData.complemento}
                  onChange={(e) => handleInputChange('complemento', e.target.value)}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#004085] focus:border-transparent text-sm sm:text-base"
                />
              </div>
            </div>
                    </div>
        </div>

                  <div id="escolaridade" className="bg-white rounded-lg shadow-lg overflow-hidden mt-6">
            <div className="bg-[#004085] text-white px-4 sm:px-6 py-3 sm:py-4">
              <h2 className="text-xl sm:text-2xl font-bold">Escolaridade</h2>
            </div>

          <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Grau de Instrução <span className="text-red-500">*</span>
                </label>
                <select 
                  value={formData.grauInstrucao}
                  onChange={(e) => handleInputChange('grauInstrucao', e.target.value)}
                  className={`w-full px-3 sm:px-4 py-2 sm:py-3 border rounded-lg focus:ring-2 focus:ring-[#004085] focus:border-transparent text-sm sm:text-base bg-white ${
                    fieldErrors.grauInstrucao ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">Selecione</option>
                  <option value="fundamental">Fundamental</option>
                  <option value="medio">Médio</option>
                  <option value="tecnico">Técnico</option>
                  <option value="superior">Superior</option>
                  <option value="pos-graduacao">Pós-graduação</option>
                </select>
                {fieldErrors.grauInstrucao && (
                  <p className="text-red-500 text-sm mt-1">{fieldErrors.grauInstrucao}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Matrícula
                </label>
                <input
                  type="text"
                  placeholder=""
                  value={formData.matricula}
                  onChange={(e) => handleInputChange('matricula', e.target.value)}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#004085] focus:border-transparent text-sm sm:text-base"
                />
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-700 mb-3">Horário Disponível</h3>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input type="checkbox" className="mr-3 h-4 w-4 text-[#004085] focus:ring-[#004085] border-gray-300 rounded" />
                    <span className="text-gray-700">Manhã</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="mr-3 h-4 w-4 text-[#004085] focus:ring-[#004085] border-gray-300 rounded" />
                    <span className="text-gray-700">Tarde</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="mr-3 h-4 w-4 text-[#004085] focus:ring-[#004085] border-gray-300 rounded" />
                    <span className="text-gray-700">Noite</span>
                  </label>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-700 mb-3">Horário de Estudo</h3>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input type="checkbox" className="mr-3 h-4 w-4 text-[#004085] focus:ring-[#004085] border-gray-300 rounded" />
                    <span className="text-gray-700">Manhã</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="mr-3 h-4 w-4 text-[#004085] focus:ring-[#004085] border-gray-300 rounded" />
                    <span className="text-gray-700">Tarde</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="mr-3 h-4 w-4 text-[#004085] focus:ring-[#004085] border-gray-300 rounded" />
                    <span className="text-gray-700">Noite</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="mr-3 h-4 w-4 text-[#004085] focus:ring-[#004085] border-gray-300 rounded" />
                    <span className="text-gray-700">Online</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

                  <div id="cursos" className="bg-white rounded-lg shadow-lg overflow-hidden mt-6">
            <div className="bg-[#004085] text-white px-4 sm:px-6 py-3 sm:py-4">
              <h2 className="text-xl sm:text-2xl font-bold">Cursos</h2>
            </div>

          <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Inglês
                </label>
                <select className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#004085] focus:border-transparent text-sm sm:text-base bg-white">
                  <option value="">Nenhum</option>
                  <option value="basico">Básico</option>
                  <option value="intermediario">Intermediário</option>
                  <option value="avancado">Avançado</option>
                  <option value="fluente">Fluente</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Francês
                </label>
                <select className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#004085] focus:border-transparent text-sm sm:text-base bg-white">
                  <option value="">Nenhum</option>
                  <option value="basico">Básico</option>
                  <option value="intermediario">Intermediário</option>
                  <option value="avancado">Avançado</option>
                  <option value="fluente">Fluente</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Espanhol
                </label>
                <select className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#004085] focus:border-transparent text-sm sm:text-base bg-white">
                  <option value="">Nenhum</option>
                  <option value="basico">Básico</option>
                  <option value="intermediario">Intermediário</option>
                  <option value="avancado">Avançado</option>
                  <option value="fluente">Fluente</option>
                </select>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-700 mb-3">Conhecimentos em informática</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-4">
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input type="checkbox" className="mr-3 h-4 w-4 text-[#004085] focus:ring-[#004085] border-gray-300 rounded" />
                    <span className="text-gray-700">ACCESS</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="mr-3 h-4 w-4 text-[#004085] focus:ring-[#004085] border-gray-300 rounded" />
                    <span className="text-gray-700">ASP</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="mr-3 h-4 w-4 text-[#004085] focus:ring-[#004085] border-gray-300 rounded" />
                    <span className="text-gray-700">COREL DRAW</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="mr-3 h-4 w-4 text-[#004085] focus:ring-[#004085] border-gray-300 rounded" />
                    <span className="text-gray-700">DIGITAÇÃO</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="mr-3 h-4 w-4 text-[#004085] focus:ring-[#004085] border-gray-300 rounded" />
                    <span className="text-gray-700">FLASH</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="mr-3 h-4 w-4 text-[#004085] focus:ring-[#004085] border-gray-300 rounded" />
                    <span className="text-gray-700">GESTÃO FINANCEIRA</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="mr-3 h-4 w-4 text-[#004085] focus:ring-[#004085] border-gray-300 rounded" />
                    <span className="text-gray-700">HTML</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="mr-3 h-4 w-4 text-[#004085] focus:ring-[#004085] border-gray-300 rounded" />
                    <span className="text-gray-700">JAVA</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="mr-3 h-4 w-4 text-[#004085] focus:ring-[#004085] border-gray-300 rounded" />
                    <span className="text-gray-700">PHOTOSHOP</span>
                  </label>
                </div>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input type="checkbox" className="mr-3 h-4 w-4 text-[#004085] focus:ring-[#004085] border-gray-300 rounded" />
                    <span className="text-gray-700">ADOBE PAGEMAKER</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="mr-3 h-4 w-4 text-[#004085] focus:ring-[#004085] border-gray-300 rounded" />
                    <span className="text-gray-700">AUTO CAD</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="mr-3 h-4 w-4 text-[#004085] focus:ring-[#004085] border-gray-300 rounded" />
                    <span className="text-gray-700">DELPHI</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="mr-3 h-4 w-4 text-[#004085] focus:ring-[#004085] border-gray-300 rounded" />
                    <span className="text-gray-700">EXCEL</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="mr-3 h-4 w-4 text-[#004085] focus:ring-[#004085] border-gray-300 rounded" />
                    <span className="text-gray-700">FRONTPAGE</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="mr-3 h-4 w-4 text-[#004085] focus:ring-[#004085] border-gray-300 rounded" />
                    <span className="text-gray-700">HARDWARE</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="mr-3 h-4 w-4 text-[#004085] focus:ring-[#004085] border-gray-300 rounded" />
                    <span className="text-gray-700">INTERNET</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="mr-3 h-4 w-4 text-[#004085] focus:ring-[#004085] border-gray-300 rounded" />
                    <span className="text-gray-700">LINUX</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="mr-3 h-4 w-4 text-[#004085] focus:ring-[#004085] border-gray-300 rounded" />
                    <span className="text-gray-700">PHP / MYSQL</span>
                  </label>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-700 mb-3">Aperfeiçoamento / Experiência</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-4">
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input type="checkbox" className="mr-3 h-4 w-4 text-[#004085] focus:ring-[#004085] border-gray-300 rounded" />
                    <span className="text-gray-700">AERÓBICA</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="mr-3 h-4 w-4 text-[#004085] focus:ring-[#004085] border-gray-300 rounded" />
                    <span className="text-gray-700">ÁREA JURÍDICA</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="mr-3 h-4 w-4 text-[#004085] focus:ring-[#004085] border-gray-300 rounded" />
                    <span className="text-gray-700">ATENDIMENTO AO PÚBLICO</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="mr-3 h-4 w-4 text-[#004085] focus:ring-[#004085] border-gray-300 rounded" />
                    <span className="text-gray-700">CRÉDITO E COBRANÇA</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="mr-3 h-4 w-4 text-[#004085] focus:ring-[#004085] border-gray-300 rounded" />
                    <span className="text-gray-700">ELETRÔNICA</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="mr-3 h-4 w-4 text-[#004085] focus:ring-[#004085] border-gray-300 rounded" />
                    <span className="text-gray-700">ENFERMAGEM</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="mr-3 h-4 w-4 text-[#004085] focus:ring-[#004085] border-gray-300 rounded" />
                    <span className="text-gray-700">HIDROGINÁSTICA</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="mr-3 h-4 w-4 text-[#004085] focus:ring-[#004085] border-gray-300 rounded" />
                    <span className="text-gray-700">LOGISTICA</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="mr-3 h-4 w-4 text-[#004085] focus:ring-[#004085] border-gray-300 rounded" />
                    <span className="text-gray-700">MONITOR DE RECREAÇÃO</span>
                  </label>
                </div>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input type="checkbox" className="mr-3 h-4 w-4 text-[#004085] focus:ring-[#004085] border-gray-300 rounded" />
                    <span className="text-gray-700">ÁREA CONTÁBIL</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="mr-3 h-4 w-4 text-[#004085] focus:ring-[#004085] border-gray-300 rounded" />
                    <span className="text-gray-700">ASSISTENTE EDUCACIONAL</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="mr-3 h-4 w-4 text-[#004085] focus:ring-[#004085] border-gray-300 rounded" />
                    <span className="text-gray-700">AUXILIAR DE ESCRITÓRIO</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="mr-3 h-4 w-4 text-[#004085] focus:ring-[#004085] border-gray-300 rounded" />
                    <span className="text-gray-700">ELETRICIDADE BÁSICA</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="mr-3 h-4 w-4 text-[#004085] focus:ring-[#004085] border-gray-300 rounded" />
                    <span className="text-gray-700">ELETROTÉCNICA</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="mr-3 h-4 w-4 text-[#004085] focus:ring-[#004085] border-gray-300 rounded" />
                    <span className="text-gray-700">GINÁSTICA</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="mr-3 h-4 w-4 text-[#004085] focus:ring-[#004085] border-gray-300 rounded" />
                    <span className="text-gray-700">JORNAL</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="mr-3 h-4 w-4 text-[#004085] focus:ring-[#004085] border-gray-300 rounded" />
                    <span className="text-gray-700">MARKETING</span>
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" className="mr-3 h-4 w-4 text-[#004085] focus:ring-[#004085] border-gray-300 rounded" />
                    <span className="text-gray-700">MONTAGEM E CONFIGURAÇÃO</span>
                  </label>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Outros Cursos
              </label>
              <textarea
                rows={4}
                placeholder=""
                className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#004085] focus:border-transparent text-sm sm:text-base resize-none"
              />
            </div>
          </div>
        </div>

                  <div id="experiencia" className="bg-white rounded-lg shadow-lg overflow-hidden mt-6">
            <div className="bg-[#004085] text-white px-4 sm:px-6 py-3 sm:py-4">
              <h2 className="text-xl sm:text-2xl font-bold">Experiência Profissional</h2>
            </div>

          <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
            {[1, 2, 3].map((index) => (
              <div key={index} className="border-b border-gray-200 pb-6 last:border-b-0">
                <div className="grid grid-cols-1 gap-4 sm:gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Empresa
                    </label>
                    <input
                      type="text"
                      placeholder="Nome da empresa"
                      className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#004085] focus:border-transparent text-sm sm:text-base"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Atribuições
                    </label>
                    <textarea
                      rows={3}
                      placeholder=""
                      className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#004085] focus:border-transparent text-sm sm:text-base resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Entrada
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <select className="px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#004085] focus:border-transparent text-sm sm:text-base bg-white">
                          <option value="janeiro">Janeiro</option>
                          <option value="fevereiro">Fevereiro</option>
                          <option value="marco">Março</option>
                          <option value="abril">Abril</option>
                          <option value="maio">Maio</option>
                          <option value="junho">Junho</option>
                          <option value="julho">Julho</option>
                          <option value="agosto">Agosto</option>
                          <option value="setembro">Setembro</option>
                          <option value="outubro">Outubro</option>
                          <option value="novembro">Novembro</option>
                          <option value="dezembro">Dezembro</option>
                        </select>
                        <input
                          type="number"
                          placeholder="1990"
                          className="px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#004085] focus:border-transparent text-sm sm:text-base"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Saída
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <select className="px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#004085] focus:border-transparent text-sm sm:text-base bg-white">
                          <option value="janeiro">Janeiro</option>
                          <option value="fevereiro">Fevereiro</option>
                          <option value="marco">Março</option>
                          <option value="abril">Abril</option>
                          <option value="maio">Maio</option>
                          <option value="junho">Junho</option>
                          <option value="julho">Julho</option>
                          <option value="agosto">Agosto</option>
                          <option value="setembro">Setembro</option>
                          <option value="outubro">Outubro</option>
                          <option value="novembro">Novembro</option>
                          <option value="dezembro">Dezembro</option>
                        </select>
                        <input
                          type="number"
                          placeholder="1990"
                          className="px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#004085] focus:border-transparent text-sm sm:text-base"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

          <div className="flex justify-center sm:justify-end pt-4 sm:pt-6">
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto bg-[#FFC107] hover:bg-[#FFD700] disabled:bg-gray-400 text-black font-bold py-2 sm:py-3 px-6 sm:px-8 rounded-lg transition-colors text-sm sm:text-base"
            >
              {loading ? 'Enviando...' : 'Enviar Cadastro'}
            </button>
          </div>
        </form>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
