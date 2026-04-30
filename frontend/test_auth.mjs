import { createClient } from '@supabase/supabase-js';

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

(async () => {
    await testLogin('nischay@theboringpeople.in', 'password123');
})();
