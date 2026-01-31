// scripts/release.js
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// --- CONFIGURAÇÃO ---
const ROOT_DIR = path.resolve(__dirname, '..');

// Pacotes para sincronizar versão
const PACKAGES_TO_SYNC = [
  'packages/vatts',
  'packages/auth',
];

// Onde gerar Changelogs
const CHANGELOG_TARGETS = [
  'CHANGELOG.md',             // Raiz
  'packages/auth/CHANGELOG.md', // Auth
  'packages/vatts/CHANGELOG.md'  // Vatts
];

// Configuração do Core-Go
const CORE_GO_DIR = path.join(ROOT_DIR, 'services/core-go');
const CORE_BINARIES_DIR = path.join(CORE_GO_DIR, 'binaries');
const REQUIRED_BINARIES = [
  'core-win-x64.node',
  'core-linux-x64.node',
  'core-linux-arm64.node'
];

// Configuração Git
const BRANCH_DEV = 'canary'; // A branch onde você desenvolve
const BRANCH_PROD = 'latest'; // A branch de release

// Lê o package.json da raiz para pegar a nova versão
const rootPkg = require(path.join(ROOT_DIR, 'package.json'));
const NEW_VERSION = rootPkg.version;

console.log(`🚀 Iniciando release da versão: ${NEW_VERSION}`);

try {
  // ---------------------------------------------------------
  // 1. Verificação do Core-Go (Binários)
  // ---------------------------------------------------------
  console.log('🕵️  Verificando binários do Core-Go...');
  
  let missingBinaries = [];
  
  if (fs.existsSync(CORE_BINARIES_DIR)) {
    missingBinaries = REQUIRED_BINARIES.filter(bin => 
      !fs.existsSync(path.join(CORE_BINARIES_DIR, bin))
    );
  } else {
    missingBinaries = REQUIRED_BINARIES;
  }

  if (missingBinaries.length > 0) {
    console.warn(`   ⚠️  Binários faltando: ${missingBinaries.join(', ')}`);
    console.log('   🔨 Compilando Core-Go (pnpm run build)...');
    
    execSync('pnpm run build', { 
      cwd: CORE_GO_DIR, 
      stdio: 'inherit' 
    });
    console.log('   ✅ Core-Go compilado com sucesso!');
  } else {
    console.log('   ✅ Todos os binários do Core-Go estão presentes.');
  }

  // ---------------------------------------------------------
  // 2. Sincronizar Versões
  // ---------------------------------------------------------
  console.log('🔄 Sincronizando versões nos pacotes...');
  PACKAGES_TO_SYNC.forEach(pkgPath => {
    const fullPath = path.join(ROOT_DIR, pkgPath, 'package.json');
    
    if (fs.existsSync(fullPath)) {
      const pkg = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
      pkg.version = NEW_VERSION;
      
      if (pkg.dependencies && pkg.dependencies['vatts']) {
          pkg.dependencies['vatts'] = `^${NEW_VERSION}`;
      }

      fs.writeFileSync(fullPath, JSON.stringify(pkg, null, 2) + '\n');
      console.log(`   ✅ Atualizado: ${pkgPath} -> ${NEW_VERSION}`);
    } else {
      console.warn(`   ⚠️  Não encontrado: ${pkgPath}`);
    }
  });

  // ---------------------------------------------------------
  // 3. Gerar Changelogs (Raiz e Auth)
  // ---------------------------------------------------------
  console.log('📝 Gerando Changelogs...');
  
  const lastCommitMsg = execSync('git log -1 --pretty=%B').toString().trim();
  const date = new Date().toISOString().split('T')[0];
  
  const generateChangelog = (relativePath) => {
    const logPath = path.join(ROOT_DIR, relativePath);
    const header = `## ${NEW_VERSION} (${date})`;
    const content = `${header}\n\n${lastCommitMsg}\n\n`;

    let oldContent = '';
    if (fs.existsSync(logPath)) {
      oldContent = fs.readFileSync(logPath, 'utf-8');
    }

    fs.writeFileSync(logPath, content + oldContent);
    console.log(`   ✅ Changelog atualizado em: ${relativePath}`);
  };

  CHANGELOG_TARGETS.forEach(target => generateChangelog(target));

  // ---------------------------------------------------------
  // 4. Build e Publish (Vatts Framework)
  // ---------------------------------------------------------
  console.log('📦 Rodando Build e Publish do Framework...');

  execSync('pnpm run build', { stdio: 'inherit', cwd: ROOT_DIR });

  const publishFilter = `--filter "./packages/vatts" --filter "./packages/auth"`;
  
  const tagArg = NEW_VERSION.includes('canary') || NEW_VERSION.includes('alpha') 
      ? '--tag canary' 
      : '';

  const publishCmd = `pnpm publish -r ${publishFilter} --no-git-checks --access=public ${tagArg}`;
  
  console.log(`   Executando: ${publishCmd}`);
  execSync(publishCmd, { stdio: 'inherit', cwd: ROOT_DIR });

  // ---------------------------------------------------------
  // 5. Git & GitHub Flow
  // ---------------------------------------------------------
  console.log('🐙 Iniciando operações Git e GitHub...');

  // 5.1 Commit na branch atual (canary) IGNORANDO A PASTA DOCS
  console.log(`   📌 Commitando alterações (ignorando ./docs)...`);
  
  // O ":!docs" diz para o git adicionar tudo EXCETO o caminho docs
  execSync('git add . -- ":!docs"', { cwd: ROOT_DIR });
  
  try {
    execSync(`git commit -m "chore(release): v${NEW_VERSION}"`, { cwd: ROOT_DIR });
  } catch (e) {
    console.log('   ⚠️  Nada para comitar (talvez já tenha sido comitado).');
  }
  
  // Pega o nome da branch atual (canary)
  const currentBranch = execSync('git branch --show-current').toString().trim();
  console.log(`   🌿 Branch atual: ${currentBranch}`);

  // 5.2 Hard Reset na Latest (Sem Merge)
  // Aqui fazemos o "latest" virar exatamente o que o "canary" é agora.
  console.log(`   🔄 Forçando a branch ${BRANCH_PROD} a ser idêntica a ${currentBranch}...`);
  
  execSync(`git checkout ${BRANCH_PROD}`, { stdio: 'inherit', cwd: ROOT_DIR });
  
  // Hard reset faz a branch local latest ficar IGUAL à branch de origem (canary)
  execSync(`git reset --hard ${currentBranch}`, { stdio: 'inherit', cwd: ROOT_DIR });
  
  // Force push é obrigatório aqui pois reescrevemos o histórico do latest
  console.log(`   🔥 Enviando ${BRANCH_PROD} com Force Push...`);
  execSync(`git push origin ${BRANCH_PROD} --force`, { stdio: 'inherit', cwd: ROOT_DIR });

  // 5.3 Criar Release no GitHub
  console.log('   🏷️  Criando Release no GitHub...');
  try {
    const releaseNotes = lastCommitMsg.replace(/"/g, '\\"');
    // Nota: target agora é BRANCH_PROD (que acabamos de resetar)
    const ghCommand = `gh release create v${NEW_VERSION} --title "v${NEW_VERSION}" --notes "${releaseNotes}" --target ${BRANCH_PROD}`;
    execSync(ghCommand, { stdio: 'inherit', cwd: ROOT_DIR });
    console.log('   ✅ Release criada via GitHub CLI!');
  } catch (err) {
    console.warn('   ⚠️  GitHub CLI (gh) falhou ou não instalado. Criando tag git manual.');
    execSync(`git tag v${NEW_VERSION}`, { cwd: ROOT_DIR });
    execSync('git push --tags', { stdio: 'inherit', cwd: ROOT_DIR });
    console.log('   ✅ Tag v' + NEW_VERSION + ' enviada!');
  }

  // 5.4 Voltar para Canary
  console.log(`   🔙 Voltando para a branch ${BRANCH_DEV}...`);
  execSync(`git checkout ${BRANCH_DEV}`, { stdio: 'inherit', cwd: ROOT_DIR });

  console.log(`✨ Release ${NEW_VERSION} concluído com sucesso!`);

} catch (e) {
  console.error('\n❌ Erro Crítico durante o release:', e.message);
  if (e.stdout) console.error(e.stdout.toString());
  process.exit(1);
}