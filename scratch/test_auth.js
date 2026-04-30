const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lgbzuqjkkazurbedoizp.supabase.co';
const supabaseAnonKey = 'sb_publishable_duIAxgQgVmd9RMxArQiE-Q_Gt8Ildnk';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testLogin(email, password) {
    console.log(`Testing login for ${email} with password: ${password}`);
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });

    if (error) {
        console.error(`Error: ${error.message} (status: ${error.status})`);
    } else {
        console.log(`Success! User ID: ${data.user.id}`);
    }
}

const passwords = ['Forge@2026+2025', 'password', 'nischay@theboringpeople.in', 'ForgeTrack2026'];
(async () => {
    for (const p of passwords) {
        await testLogin('nischay@theboringpeople.in', p);
    }
})();
