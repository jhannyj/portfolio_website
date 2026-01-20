import { useState, useEffect } from 'react'
import Navigation from './Navigation'
import HeroContent from './HeroContent'
import ScrollIndicator from './ScrollIndicator'
import './Hero.css'

function Hero() {
    const [isVisible, setIsVisible] = useState(false)

    useEffect(() => {
        setIsVisible(true)
    }, [])

    return (
        <div className={`hero-container ${isVisible ? 'visible' : ''}`}>
            <Navigation />
            <HeroContent />
            <ScrollIndicator />
        </div>
    )
}

export default Hero