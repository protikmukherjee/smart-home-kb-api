IoT Knowledge Base Metamodel1. OverviewThe IoT Knowledge Base Metamodel is a hybrid ontology designed to support the automated selection and validation of IoT hardware components. It combines a strict taxonomic hierarchy for component classification with the W3C SOSA (Sensor, Observation, Sample, and Actuator) standard for semantic functional definitions.2. Visual Architecture (UML Class Diagram)classDiagram
    %% Core Abstract Class
    class Part {
        +String label
        +String mpn
        +String manufacturer
        +String partKind
        +Decimal price
        +String lifecycle
        +String datasheetURL
    }

    %% Functional Interfaces & Specs
    class ElectricalSpec {
        +Decimal vccMin
        +Decimal vccMax
        +Decimal logicLevel
        +Decimal activeCurrent_mA
    }
    
    class PhysicalSpec {
        +String packageCase
        +Integer pinCount
        +Decimal tempMin
        +Decimal tempMax
    }

    class Interface {
        <<Enumeration>>
        I2C
        SPI
        UART
        GPIO
        ADC
        PWM
    }

    %% The 6 Taxonomic Pillars
    class SensorPart {
        +Decimal sampleRateHz
        +Decimal accuracyPct
    }
    class ActuatorPart {
        +Decimal latencyMs
    }
    class ControllerBoard {
        +Decimal clockSpeedMHz
    }
    class PowerSupply
    class Mechanical
    class Tooling

    %% Semantic Concepts (SOSA)
    class ObservableProperty
    class ActuatableProperty
    class FeatureOfInterest

    %% Relationships
    Part <|-- SensorPart
    Part <|-- ActuatorPart
    Part <|-- ControllerBoard
    Part <|-- PowerSupply
    Part <|-- Mechanical
    Part <|-- Tooling

    Part *-- ElectricalSpec : has
    Part *-- PhysicalSpec : has
    Part --> "0..*" Interface : hasInterface

    SensorPart --> "1..*" ObservableProperty : sosa:observes
    SensorPart --> "0..1" FeatureOfInterest : sosa:hasFeatureOfInterest
    
    ActuatorPart --> "1..*" ActuatableProperty : sosa:actsOn
    ActuatorPart --> "0..1" FeatureOfInterest : sosa:hasFeatureOfInterest
3. Entity Definitions3.1. Core Entity: PartThe abstract base entity representing any physical component in the inventory.Unique Identifier (IRI): Generated from part_label (e.g., ex:HC_SR04).Source: iotkb_refined.csv3.2. Taxonomic SubclassesEvery part must be instantiated as exactly one of these six mutually exclusive classes:ClassDefinitionEquivalent SOSA TermExampleSensorPartA device that detects or measures a physical property and records, indicates, or otherwise responds to it.sosa:SensorDHT11, BNO055ActuatorPartA device responsible for moving or controlling a mechanism or system.sosa:ActuatorServo, LED, RelayControllerBoardA compute module capable of executing logic and interfacing with other components.N/AESP32, ArduinoPowerSupplyA component that provides, regulates, or stores electrical energy.N/ALipo Battery, Buck ConverterMechanicalStructural elements with no electrical function in the logic path.N/AChassis, BracketToolingItems required for assembly, prototyping, or connectivity.N/ABreadboard, Wires4. Semantic Definitions (SOSA Alignment)This layer allows the recommender to understand what a component does, enabling queries like "Find a sensor for Room Temperature."4.1. Observable Property (sosa:observesProperty)Domain: SensorPartDefinition: The specific quality or characteristic of a feature of interest that can be observed.Values: temperature, humidity, acceleration, motion.4.2. Actuatable Property (sosa:actsOnProperty)Domain: ActuatorPartDefinition: The characteristic of a feature of interest that is altered by the actuator.Values: angular_position (Servo), luminous_flux (LED), fluid_flow (Valve).4.3. Feature of Interest (sosa:hasFeatureOfInterest)Domain: SensorPart, ActuatorPartDefinition: The real-world entity whose property is being observed or acted upon.Values: room_air, human_presence, robotic_arm, liquid_pipe.5. Technical Specification ModelThis layer defines the engineering constraints used for validation (e.g., "Does this 3.3V sensor work with this 5V controller?").5.1. Electrical ProfileAttributeTypeDescriptionvccMinDecimalMinimum supply voltage required for operation.vccMaxDecimalMaximum supply voltage before damage occurs.logicLevelDecimalThe voltage level of the I/O signals (High). Critical for compatibility.iActive_mADecimalCurrent consumption during active measurement/actuation.5.2. Interface ProfileAttributeTypeDescriptionhasInterfaceObjectThe communication protocol used (e.g., ex:I2C, ex:UART, ex:GPIO).i2cAddrRangeStringValid hex addresses (e.g., 0x60-0x68) for conflict checking.6. Mapping: Data Layer to MetamodelThis table defines how the CSV columns map to the Metamodel attributes.CSV ColumnMetamodel AttributeRDF Property (ex:)RangecategoryClassrdf:typeowl:ClasskindpartKindex:partKindxsd:stringpart_labellabelrdfs:labelxsd:stringmpnmpnex:mpnxsd:stringobserved_propertyobservessosa:observesPropertysosa:ObservablePropertyactuatable_propertyactsOnsosa:actsOnPropertysosa:ActuatablePropertyfeature_of_interestfeatureOfInterestsosa:hasFeatureOfInterestsosa:FeatureOfInterestvcc_minvccMinex:vccMinxsd:decimallogic_levellogicLevelex:logicLevelxsd:decimalifacehasInterfaceex:hasInterfaceex:Interfacepackage_casepackageCaseex:packageCasexsd:stringoffer_pricepriceex:offerPricexsd:decimal