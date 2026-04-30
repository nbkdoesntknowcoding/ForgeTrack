import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lgbzuqjkkazurbedoizp.supabase.co';
const supabaseAnonKey = 'sb_publishable_duIAxgQgVmd9RMxArQiE-Q_Gt8Ildnk';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testApi() {
    console.log('Testing API...');
    const { data, error } = await supabase.from('sessions').select('count', { count: 'exact' });

    if (error) {
        console.error(`Error: ${error.message} (status: ${error.status})`);
    } else {
        console.log(`Success! Count: ${data.length}`);
    }
}

testApi();
