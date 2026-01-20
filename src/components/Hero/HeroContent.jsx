import LossLandscape from './LossLandscape';

function HeroContent() {
    return (
        <section className="hero-content">
            <div className="hero-graphics-space">
                {/* 3D Landscape now handles its own background internally */}
                <LossLandscape />
            </div>

            <div className="hero-bottom">
                <h1 className="hero-title">
                    <span className="title-word">CURIOSITY</span>
                    <span className="title-word">DRIVE</span>
                    <span className="title-word">IMPACT</span>
                </h1>
            </div>
        </section>
    )
}

export default HeroContent;