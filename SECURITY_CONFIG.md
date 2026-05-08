# 🔐 Configuration Sécurisée — Carte-Fidelité

## Variables d'Environnement Requises

### Supabase
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Apple Wallet
```env
APPLE_PASS_TYPE_ID=pass.com.yourcompany.fidelite
APPLE_TEAM_ID=ABCDE12345
WWDR_PEM_PATH=certs/wwdr.pem
SIGNER_CERT_PATH=certs/signerCert.pem
SIGNER_KEY_PATH=certs/signerKey.pem
SIGNER_KEY_PASSPHRASE=your-passphrase
```

### Google Wallet
```env
GOOGLE_ISSUER_ID=your-issuer-id
GOOGLE_WALLET_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

## Fichiers de Certificats

**Important** : Ces fichiers contiennent des secrets. Ne jamais les committer.

```bash
# Ajouter à .gitignore
echo "certs/" >> .gitignore
echo ".env.local" >> .gitignore
```

### Structure requise
```
certs/
├── wwdr.pem          # Apple WWDR Certificate (télécharger depuis Apple)
├── signerCert.pem    # Apple Signer Certificate
├── signerKey.pem     # Apple Signer Private Key
└── credentials.json  # Google Service Account JSON
```

### Comment obtenir les certificats

**Apple** :
1. Aller sur https://developer.apple.com/account
2. Certificats → Pass Type IDs
3. Télécharger les certificats
4. Convertir en PEM si nécessaire

**Google** :
1. Google Cloud Console → Service Accounts
2. Créer une clé → Télécharger JSON
3. Copier dans `certs/credentials.json`

## Production Checklist

- [ ] Utiliser AWS Secrets Manager ou HashiCorp Vault
- [ ] Rotation des secrets tous les 90 jours
- [ ] Logs des accès aux secrets activés
- [ ] Rate limiting > 10 req/s (actuellement 30/hour par utilisateur)
- [ ] HTTPS + HSTS enforced
- [ ] RLS (Row Level Security) activé sur Supabase
- [ ] Audit logging implémenté
- [ ] Monitoring & alertes configurés
- [ ] Backup quotidien de la BDD
- [ ] Tests de sécurité réguliers

## Secrets Manager Setup (AWS)

```bash
# Créer secret
aws secretsmanager create-secret \
  --name walletcard/supabase-key \
  --secret-string "$SUPABASE_SERVICE_ROLE_KEY"

# Référencer dans .env (via Lambda/ECS)
export SUPABASE_SERVICE_ROLE_KEY=$(aws secretsmanager get-secret-value --secret-id walletcard/supabase-key | jq -r '.SecretString')
```

## Audit des Secrets

Rechercher les secrets en dur :
```bash
# Secrets potentiels
git log --all --full-history -- certs/ | grep "commit\|Date"
grep -r "NEXT_PUBLIC_SUPABASE" src/
grep -r "private_key" src/
grep -r "apiKey" src/
```

Ne rien laisser traîner dans le code, les logs, ou les commits.
