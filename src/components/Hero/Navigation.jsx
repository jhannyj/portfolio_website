function Navigation() {
    return (
        <nav className="nav">
            <div className="nav-brand">
                <svg className="logo-mark" width="50" height="50" viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="5" y="5" width="8" height="40" fill="currentColor"/>
                    <rect x="17" y="5" width="8" height="40" fill="currentColor"/>
                    <rect x="29" y="5" width="8" height="40" fill="currentColor"/>
                    <rect x="41" y="5" width="4" height="40" fill="currentColor"/>
                </svg>
                <div className="brand-text">
                    <div className="brand-name">Jhanny Jimenez</div>
                    <div className="brand-subtitle">SOFTWARE • SYSTEMS • ML</div>
                </div>
            </div>
            <ul className="nav-links">
                <li><a href="#about">ABOUT</a></li>
                <li><a href="#work">WORK</a></li>
                <li><a href="#contact">CONTACT</a></li>
            </ul>
            <div className="nav-cta">
                <a href="mailto:jhanny@mit.edu" className="cta-link">
                    Available for opportunities → <span>Let's connect</span>
                </a>
            </div>
        </nav>
    )
}

export default Navigation