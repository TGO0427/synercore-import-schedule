import React from 'react';

function App() {
  return (
    <div className="container" style={{display: 'flex', height: '100vh'}}>
      <div className="sidebar" style={{width: '250px', background: 'blue', color: 'white', padding: '1rem'}}>
        <h2>Synercore Import Schedule</h2>
        <p>This is the sidebar</p>
      </div>
      <div className="main-content" style={{flex: 1, background: 'white', padding: '1rem'}}>
        <h1>Main Content</h1>
        <p>This should be the main area</p>
      </div>
    </div>
  );
}

export default App;