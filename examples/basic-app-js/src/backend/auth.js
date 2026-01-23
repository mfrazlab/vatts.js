import {
    AuthConfig,
    createAuthRoutes,
    CredentialsProvider,
    DiscordProvider,
    GithubProvider,
    GoogleProvider,
    User
} from '@vatts/auth';


export const authConfig = {
    providers: [
        new CredentialsProvider({
            authorize(credentials) {
                if (credentials.username === 'jsmith' && credentials.password === 'password123') {
                    return {
                        id: '1',
                        name: 'John Smith',
                        email: 'john.smith@gmail.com'
                    }
                }
                return null;
            },
            credentials: {
                username: { label: "Username", type: "text", placeholder: "jsmith" },
                password: { label: "Password", type: "password" }
            }
        }),
        new GoogleProvider({
            clientId: process.env.OAUTH_GOOGLE_CLIENT_ID,
            clientSecret: process.env.OAUTH_GOOGLE_CLIENT_SECRET,
            scope: ['openid', 'email', 'profile'],
            callbackUrl: 'http://localhost:3000/api/auth/callback/google',
            successUrl: 'http://localhost:3000'
        }),
        new DiscordProvider({
            clientId: process.env.OAUTH_DISCORD_CLIENT_ID,
            clientSecret: process.env.OAUTH_DISCORD_CLIENT_SECRET,
            scope: ['identify', 'email'],
            callbackUrl: 'http://localhost:3000/api/auth/callback/discord',
            successUrl: 'http://localhost:3000'
        }),
        new GithubProvider({
            clientId: process.env.OAUTH_GITHUB_CLIENT_ID,
            clientSecret: process.env.OAUTH_GITHUB_CLIENT_SECRET,
            scope: ["read:user", "user:email"],
            callbackUrl: 'http://localhost:3000/api/auth/callback/github',
            successUrl: 'http://localhost:3000'
        })
    ],

    session: {
        strategy: 'jwt',
        maxAge: 24 * 60 * 60,
    },

    pages: {
        signIn: '/login',
        signOut: '/'
    },
    callbacks: {
        async session({session, provider}) {
            if(provider !== 'credentials') {
                session.user = {
                    id: session.user.id,
                    name: session.user.name,
                    email: session.user.email
                }
            }

            return session;
        }
    },
    // ⚠️ SECURITY WARNING: Change this secret in production!
    // Generate a strong secret with: node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
    // Or use environment variable: process.env.VATTS_AUTH_SECRET
    secret: 'hweb-test-secret-key-change-in-production'
};

export const authRoutes = createAuthRoutes(authConfig);
